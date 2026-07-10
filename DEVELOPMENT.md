# HostelSet development reliability notes

Next.js writes generated server, route-manifest, and Webpack cache files under `.next/`.

- Stop `npm run dev` before running `npm run build`.
- Delete `.next` only while every Next.js process for this checkout is stopped.
- Never run two dev servers in the same checkout.
- Do not sync `.next/` through OneDrive or another cloud-sync tool.
- If generated files such as `.next/routes-manifest.json` or `.next/server/pages/*.js` disappear during development, move the repository outside OneDrive, for example `C:\Projects\HostelSet`.
- Use `npm run clean:next` only as a manual recovery command after stopping Next.js.
