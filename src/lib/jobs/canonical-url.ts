const TRACKING_PARAMETER = /^(utm_.+|ref|referrer|source|campaign|tracking|trk|gh_src)$/i;

export function canonicalizeJobUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Job URLs must use HTTP or HTTPS");
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.protocol = url.protocol.toLowerCase();

  const retained = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMETER.test(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`),
    );
  url.search = "";
  retained.forEach(([key, value]) => url.searchParams.append(key, value));

  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}
