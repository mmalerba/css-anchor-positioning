/** Fetch data from a URL. */
export async function fetchData(url: URL) {
  const response = await fetch(url.toString());
  return await response.text();
}

/** Works like `Promise.allSettled`, but supports our full browser range. */
export async function allSettled<T>(
  values: Iterable<T | PromiseLike<T>>,
): Promise<PromiseSettledResult<Awaited<T>>[]> {
  return await Promise.all(
    [...values].map(async (value) =>
      Promise.resolve(value).then(
        (value): PromiseFulfilledResult<Awaited<T>> => ({
          status: 'fulfilled',
          value,
        }),
        (reason: unknown): PromiseRejectedResult => ({
          status: 'rejected',
          reason,
        }),
      ),
    ),
  );
}

/** Checks if a Promise settlement is fulfilled. */
export function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}
