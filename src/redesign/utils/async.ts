/** Fetch data from a URL. */
export async function fetchData(url: URL) {
  const response = await fetch(url.toString());
  return await response.text();
}

/** Checks if a Promise settlement is fulfilled. */
export function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}
