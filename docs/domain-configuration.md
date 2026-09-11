# Canonical domain and HTTPS

The canonical website is https://dkrisna.es/. GitHub Pages enforces HTTPS.

The September 11, 2026 audit found that `www.dkrisna.es` points to
`dkrisna.es`, and GitHub's certificate covers only the bare domain. Visiting
`https://www.dkrisna.es` fails certificate validation before a redirect can run.

In the domain's IONOS DNS settings, replace the `www` CNAME target with
`chemaclass.github.io`. Keep the bare-domain records and the GitHub Pages
custom domain `dkrisna.es` unchanged. Wait for DNS propagation and GitHub
certificate provisioning, then confirm HTTPS works for both names and the
`www` address redirects to the canonical domain while preserving the path.

This requires domain-account access and cannot be fixed by a website commit.
The repository does not hold DNS credentials.

See [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
