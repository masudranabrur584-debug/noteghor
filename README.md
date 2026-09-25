# NoteGhor
Professional education/PDF resource website with manual bKash/Nagad/Rocket verification.

## Run locally
1. Install Node.js 18+.
2. In this folder run `npm install`.
3. Change admin credentials:
   - Windows PowerShell: `$env:ADMIN_USER="youradmin"; $env:ADMIN_PASS="your-strong-password"; npm start`
   - Linux/macOS: `ADMIN_USER=youradmin ADMIN_PASS='your-strong-password' npm start`
4. Open `http://localhost:3000`.
5. Admin: `http://localhost:3000/admin.html`

## Payment flow
Customer pays bKash/Nagad/Rocket to **01518990050**, selects the method and submits transaction ID. Admin reviews the order and approves/rejects it. Approved orders receive a download link.

## Important production notes
- The upload count is not capped by the app; actual storage is limited by your hosting/server disk, so “unlimited” means no product-count limit rather than literally unlimited storage.
- Replace the default admin password before deployment.
- For production, use HTTPS, regular backups, stronger authentication, cloud/object storage, rate limiting and a database such as PostgreSQL.
- Only upload materials you own or are licensed to distribute.
