const API_URL = "http://localhost:3000/api"
let refreshInFlight

async function refreshAccessToken() {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            const refreshToken = localStorage.getItem("refreshToken")
            if (!refreshToken) throw new Error("Your session expired. Please log in again.")
            const response = await fetch(`${API_URL}/refresh-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken })
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || !data.accessToken || !data.refreshToken) {
                throw new Error(data.message || "Your session expired. Please log in again.")
            }
            localStorage.setItem("accessToken", data.accessToken)
            localStorage.setItem("refreshToken", data.refreshToken)
            return data.accessToken
        })().finally(() => { refreshInFlight = undefined })
    }
    return refreshInFlight
}

export async function apiFetch(path, options = {}) {
    const send = (accessToken) => {
        const headers = new Headers(options.headers || {})
        if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
        return fetch(`${API_URL}/${path}`, { ...options, headers })
    }
    let response = await send(localStorage.getItem("accessToken"))
    if (response.status !== 401 || path === "refresh-token") return response
    try {
        response = await send(await refreshAccessToken())
        return response
    } catch (error) {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("role")
        if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
            window.location.assign("/login")
        }
        throw error
    }
}
