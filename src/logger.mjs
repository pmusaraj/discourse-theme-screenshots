export const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export function formatJob(job) {
  return `${job.themeId} ${job.mode} -> ${job.outputPath}`;
}
