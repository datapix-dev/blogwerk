import { Worker } from "bullmq"
import { redis } from "../lib/redis"
import { processArticleJob } from "./processors/article"
import { processImageJob } from "./processors/image"
import { processAdaptationJob } from "./processors/adaptation"
import { processEditorialJob } from "./processors/editorial"
import { processPublishJob } from "./processors/publish"

console.log("BlogPlanner Worker starting...")

const articleWorker = new Worker(
  "article-generation",
  async (job) => {
    await processArticleJob(job)
  },
  {
    connection: redis,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.pow(2, attemptsMade) * 5000,
    },
  }
)

const imageWorker = new Worker(
  "image-generation",
  async (job) => {
    await processImageJob(job)
  },
  {
    connection: redis,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.pow(2, attemptsMade) * 5000,
    },
  }
)

const editorialWorker = new Worker(
  "article-editorial",
  async (job) => { await processEditorialJob(job) },
  {
    connection: redis,
    concurrency: 2,
    settings: { backoffStrategy: (n: number) => Math.pow(2, n) * 5000 },
  }
)

const adaptationWorker = new Worker(
  "article-adaptation",
  async (job) => { await processAdaptationJob(job) },
  {
    connection: redis,
    concurrency: 2,
    settings: { backoffStrategy: (n: number) => Math.pow(2, n) * 5000 },
  }
)

const publishWorker = new Worker(
  "publish",
  async (job) => {
    await processPublishJob(job)
  },
  { connection: redis, concurrency: 2 }
)

articleWorker.on("completed", (job) =>
  console.log(`[article-generation] Job ${job.id} completed`)
)
articleWorker.on("failed", (job, err) =>
  console.error(`[article-generation] Job ${job?.id} failed:`, err.message)
)
imageWorker.on("completed", (job) =>
  console.log(`[image-generation] Job ${job.id} completed`)
)
imageWorker.on("failed", (job, err) =>
  console.error(`[image-generation] Job ${job?.id} failed:`, err.message)
)
editorialWorker.on("completed", (job) =>
  console.log(`[article-editorial] Job ${job.id} completed`)
)
editorialWorker.on("failed", (job, err) =>
  console.error(`[article-editorial] Job ${job?.id} failed:`, err.message)
)
adaptationWorker.on("completed", (job) =>
  console.log(`[article-adaptation] Job ${job.id} completed`)
)
adaptationWorker.on("failed", (job, err) =>
  console.error(`[article-adaptation] Job ${job?.id} failed:`, err.message)
)
publishWorker.on("completed", (job) =>
  console.log(`[publish] Job ${job.id} completed`)
)
publishWorker.on("failed", (job, err) =>
  console.error(`[publish] Job ${job?.id} failed:`, err.message)
)

console.log("Worker ready. Listening for jobs...")
