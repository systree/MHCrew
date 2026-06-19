# Task: Multi-Location Auth Support

## Why

When the crewapp is installed in a second GHL location, the same phone number can exist as an active crew member in multiple locations. The current auth code uses `.maybeSingle()` with no location filter — it throws a 500 if more than one row matches.

**Immediate trigger:** Owner is demoing the app to a client and will install it in their GHL location. At that point the owner's phone (+61 413 157 239) will exist in both Systree (existing) and the client location (new), breaking their own login.

---

## Affected Files

| File | What changes |
|---|---|
| `backend/src/controllers/authController.js` | `getCrewUserByPhone` + `loginWithPin` — add multi-row handling |
| `frontend/src/pages/LoginPage.jsx` | Add location-picker step when `multipleAccounts: true` |
| `frontend/src/hooks/useAuth.js` | Handle new `multipleAccounts` response shape |

---

## Backend Changes

### 1. `getCrewUserByPhone` (line 66)

**Current:**
```js
async function getCrewUserByPhone(phone) {
  const { data, error } = await supabase
    .from('mh_pwa_crew_users')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle();  // ← throws if >1 row

  if (error) throw error;
  return data;
}
```

**Change to:** return array instead of single row.
```js
async function getCrewUsersByPhone(phone) {
  const { data, error } = await supabase
    .from('mh_pwa_crew_users')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true);

  if (error) throw error;
  return data ?? [];
}
```

### 2. `verifyOtp` (line 166) — after OTP is validated

**Current:** calls `getCrewUserByPhone` → gets one user → issues JWT.

**Change:**
- Call `getCrewUsersByPhone` → get array
- If `length === 0` → 403 (no account)
- If `length === 1` → existing behaviour, issue JWT immediately
- If `length > 1` → return `multipleAccounts: true` with location list (no JWT yet):

```js
const crewUsers = await getCrewUsersByPhone(phone);

if (crewUsers.length === 0) {
  return res.status(403).json({ error: 'Your account has not been set up yet. Please contact your manager.' });
}

if (crewUsers.length > 1) {
  // Fetch company names from mh_pwa_tenants for display
  const locationIds = crewUsers.map(u => u.location_id);
  const { data: tenants } = await supabase
    .from('mh_pwa_tenants')
    .select('location_id, company_name')
    .in('location_id', locationIds);

  const locations = crewUsers.map(u => ({
    locationId: u.location_id,
    companyName: tenants?.find(t => t.location_id === u.location_id)?.company_name ?? u.location_id,
  }));

  return res.json({ multipleAccounts: true, locations });
}

// Single account — existing flow
const crewUser = crewUsers[0];
```

### 3. New endpoint: `POST /auth/select-location`

After user picks a location from the UI, frontend calls this to get the final JWT.

```js
async function selectLocation(req, res) {
  // Requires the temporary OTP-verified session (or pass phone + locationId)
  // Simplest: accept { phone, locationId } — phone was already OTP-verified in same session
  const { phone, locationId } = req.body;

  const { data: crewUser, error } = await supabase
    .from('mh_pwa_crew_users')
    .select('*')
    .eq('phone', phone)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !crewUser) {
    return res.status(403).json({ error: 'Invalid selection' });
  }

  const requiresPinSetup = !crewUser.pin_hash;
  const sessionToken = signSessionToken(crewUser);
  const timezone = await getTenantTimezone(crewUser.location_id);

  return res.json({ requiresPinSetup, sessionToken, timezone, user: publicUser(crewUser) });
}
```

Register in `backend/src/routes/auth.js`:
```js
router.post('/select-location', selectLocation);
```

### 4. `loginWithPin` (line 299)

Add optional `locationId` to the query so PIN login also works correctly in multi-location context.

```js
// After phone + pin validation:
let query = supabase
  .from('mh_pwa_crew_users')
  .select('*')
  .eq('phone', phone)
  .eq('is_active', true);

if (req.body.locationId) {
  query = query.eq('location_id', req.body.locationId);
}

const { data: crewUser, error: fetchError } = await query.maybeSingle();
```

The frontend should always send `locationId` in the PIN step once location is known (stored in Zustand after `select-location` or `verify-otp` for single-account users).

---

## Frontend Changes

### Login flow states (LoginPage.jsx)

Current states: `PHONE` → `OTP` → `PIN_SETUP` | `PIN_LOGIN`

New states: `PHONE` → `OTP` → **`LOCATION_SELECT`** (only if multipleAccounts) → `PIN_SETUP` | `PIN_LOGIN`

### `LOCATION_SELECT` step

Simple list of buttons, one per location:
```
Which account do you want to sign in to?

[ Systree Marketing ]
[ ABCShuttle        ]
```

On tap:
1. Call `POST /auth/select-location` with `{ phone, locationId }`
2. Store `locationId` in component state (pass to PIN step)
3. Navigate to `PIN_SETUP` or `PIN_LOGIN` as normal

### PIN step

Pass `locationId` in the body of `POST /auth/login-pin`:
```js
{ phone, pin, locationId }   // locationId may be null for single-account users — safe to include
```

### `useAuth.js` — `verifyOtp`

Handle new response shape:
```js
if (response.multipleAccounts) {
  // Don't store a token yet — return locations list to LoginPage
  return { multipleAccounts: true, locations: response.locations };
}
// existing single-account handling unchanged
```

---

## No DB migration required

`mh_pwa_crew_users` already has `location_id` on every row. No schema changes needed.

---

## Testing checklist

- [ ] Single-location user logs in normally (no regression)
- [ ] Multi-location user sees location picker after OTP
- [ ] Selecting a location issues the correct JWT (right `locationId`)
- [ ] PIN step works after location selection
- [ ] Wrong locationId in `select-location` → 403
- [ ] PIN login sends `locationId` and resolves to correct account
