export function useUser() {
  return { id: document.cookie.match(/user_id=(?<id>[^;]+);?/).groups.id }
  // /userId=(?<id>[^;]+);?$/).groups.id
}
