import fastify from "fastify"
import sensible from "@fastify/sensible"
import fastifyCors from "@fastify/cors"
import cookie from "@fastify/cookie"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"
dotenv.config()

const app = fastify()
app.register(sensible)
app.register(cookie, {
  secret: process.env.COOKIE_SECRET,
})

app.addHook("onRequest", (req, res, done) => {
  if (req.cookies.user_id !== CURRENT_USER_ID) {
    req.cookies.user_id = CURRENT_USER_ID
    res.clearCookie("user_id")
    res.setCookie("user_id", CURRENT_USER_ID)
  }

  done()
})

app.register(fastifyCors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
})
const prisma = new PrismaClient()

const CURRENT_USER_ID = (await prisma.users.findFirst({ where: { name: "Saifuddin" } })).id

app.listen({ port: process.env.PORT })

const COMMENT_SELECT_FIELDS = {
  id: true,
  message: true,
  comment_id: true,
  created_at: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
}

// Routes
app.get("/posts", async (req, res) => {
  return await commitToDb(
    prisma.posts.findMany({
      select: {
        id: true,
        title: true,
      },
    })
  )
})

app.get("/posts/:id", async (req, res) => {
  return await commitToDb(
    prisma.posts
      .findUnique({
        where: { id: req.params.id },
        select: {
          title: true,
          body: true,
          comments: {
            orderBy: { created_at: "desc" },
            select: {
              ...COMMENT_SELECT_FIELDS,
              _count: { select: { likes: true } },
            },
          },
        },
      })
      .then(async (post) => {
        const likes = await prisma.likes.findMany({
          where: {
            user_id: req.cookies.user_id,
            comment_id: { in: post.comments.map((comment) => comment.id) },
          },
        })

        return {
          ...post,
          comments: post.comments.map((comment) => {
            const { _count, ...commentFields } = comment

            return {
              ...commentFields,
              likedByMe: likes.find((like) => like.comment_id === comment.id),
              likeCount: _count.likes,
            }
          }),
        }
      })
  )
})

app.post("/posts/:id/comments", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.send(app.httpErrors.unprocessableEntity("Message is required."))
  }

  return await commitToDb(
    prisma.comments
      .create({
        data: {
          message: req.body.message,
          user_id: req.cookies.user_id,
          comment_id: req.body.comment_id,
          post_id: req.params.id,
        },

        select: COMMENT_SELECT_FIELDS,
      })
      .then((comment) => {
        return {
          ...comment,
          likeCount: 0,
          likedByMe: false,
        }
      })
  )
})

app.put("/posts/:postId/comments/:commentId", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.send(app.httpErrors.unprocessableEntity("Message is required."))
  }

  const { user_id } = await prisma.comments.findUnique({
    where: { id: req.params.commentId },
    select: { user_id: true },
  })

  if (user_id !== req.cookies.user_id) {
    return res.send(app.httpErrors.unauthorized("You do not have permission to edit this message."))
  }

  return await commitToDb(
    prisma.comments.update({
      where: { id: req.params.commentId },
      data: { message: req.body.message },
      select: { message: true },
    })
  )
})

app.delete("/posts/:postId/comments/:commentId", async (req, res) => {
  const { user_id } = await prisma.comments.findUnique({
    where: { id: req.params.commentId },
    select: { user_id: true },
  })

  if (user_id !== req.cookies.user_id) {
    return res.send(
      app.httpErrors.unauthorized("You do not have permission to delete this message.")
    )
  }

  return await commitToDb(
    prisma.comments.delete({
      where: { id: req.params.commentId },
      select: { id: true },
    })
  )
})

app.post("/posts/:postId/comments/:commentId/toggleLike", async (req, res) => {
  const data = {
    comment_id: req.params.commentId,
    user_id: req.cookies.user_id,
  }

  const like = await prisma.likes.findUnique({
    where: { user_id_comment_id: data },
  })

  if (like == null) {
    return await commitToDb(prisma.likes.create({ data })).then(() => {
      return { addLike: true }
    })
  } else {
    return await commitToDb(prisma.likes.delete({ where: { user_id_comment_id: data } })).then(
      () => {
        return { addLike: false }
      }
    )
  }
})

// Error handling
async function commitToDb(promise) {
  const [error, data] = await app.to(promise)

  if (error) return app.httpErrors.internalServerError(error.message)

  return data
}
