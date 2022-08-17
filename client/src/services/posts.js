import { request } from "./request"

export function getPosts() {
  return request("/posts")
}

export function getPost(id) {
  return request(`/posts/${id}`)
}
