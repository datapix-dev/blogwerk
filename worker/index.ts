import { Worker } from "bullmq"
import { redis } from "../lib/redis"

console.log("BlogPlanner Worker starting...")

const articleWorker = new Worker(
  "article-generation",
  async (job) => {
    console.log(`[article-generation] Processing job ${job.id}`)
    return { status: "stub" }
  },
  { connection: redis, concurrency: 2 }
)

const imageWorker = new Worker(
  "image-generation",
  async (job) => {
    console.log(`[image-generation] Processing job ${job.id}`)
    return { status: "stub" }
  },
  { connection: redis, concurrency: 3 }
)

const publishWorker = new Worker(
  "publish",
  async (job) => {
    console.log(`[publish] Processing job ${job.id}`)
    return { status: "stub" }
  },
  { connection: redis, concurrency: 2 }
)

articleWorker.on("completed", (job) => console.log(`[article-generation] Job ${job.id} completed`))
articleWorker.on("failed", (job, err) => console.error(`[article-generation] Job ${job?.id} failed:`, err.message))
imageWorker.on("completed", (job) => console.log(`[image-generation] Job ${job.id} completed`))
imageWorker.on("failed", (job, err) => console.error(`[image-generation] Job ${job?.id} failed:`, err.message))
publishWorker.on("completed", (job) => console.log(`[publish] Job ${job.id} completed`))
publishWorker.on("failed", (job, err) => console.error(`[publish] Job ${job?.id} failed:`, err.message))

console.log("Worker ready. Listening for jobs...")
