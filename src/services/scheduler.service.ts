import aiService from './ai.service';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;

  // Run batch predictions every Sunday at 11:59 PM (simulated with 7 days interval)
  // For production, node-cron is highly recommended.
  public start() {
    console.log('⏰ Scheduler Service started.');
    
    // Run once on start
    this.runBatchPredictions();

    // Set interval for weekly run (7 days in milliseconds)
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runBatchPredictions();
    }, ONE_WEEK);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Scheduler Service stopped.');
  }

  private async runBatchPredictions() {
    try {
      await aiService.runBatchPredictions();
    } catch (error) {
      console.error('Error in scheduled batch predictions:', error);
    }
  }
}

export default new SchedulerService();
