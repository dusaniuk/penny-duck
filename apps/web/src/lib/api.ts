const API_URL = "/api"

async function fetchApi(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (res.status === 401 && !path.includes("/auth/refresh")) {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })

    if (refreshRes.ok) {
      return fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      })
    }
  }

  return res
}

export const api = {
  get: (path: string) => fetchApi(path),
  post: (path: string, body?: unknown) =>
    fetchApi(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: (path: string, body?: unknown) =>
    fetchApi(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  del: (path: string) => fetchApi(path, { method: "DELETE" }),
}
