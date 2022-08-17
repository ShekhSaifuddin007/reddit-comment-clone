import { request } from "./request"

export function createComment({ post_id, message, comment_id }) {
  return request(`posts/${post_id}/comments`, {
    method: "post",
    data: { message, comment_id },
  })
}

export function updateComment({ post_id, message, id }) {
  return request(`posts/${post_id}/comments/${id}`, {
    method: "put",
    data: { message },
  })
}

export function deleteComment({ post_id, id }) {
  return request(`posts/${post_id}/comments/${id}`, {
    method: "delete",
  })
}

export function toggleCommentLike({ post_id, id }) {
  return request(`posts/${post_id}/comments/${id}/toggleLike`, {
    method: "post",
  })
}
