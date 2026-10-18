// Pages are counted rather than rows: a transactions page can carry extra
// transfer halves beyond `limit`, which `total` doesn't include.
export function nextPageParam(
  pagesLoaded: number,
  pageSize: number,
  total: number
): number | undefined {
  return pagesLoaded * pageSize < total ? pagesLoaded + 1 : undefined
}
