export function useRouter() { return { push: (url: string) => { location.href = url }, replace: (url: string) => { location.href = url } } }
