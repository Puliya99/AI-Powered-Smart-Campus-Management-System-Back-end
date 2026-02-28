import { AppDataSource, initializeDatabase } from '../config/database';
import aiService from '../services/ai.service';
import { Student } from '../entities/Student.entity';
import { Module } from '../entities/Module.entity';

async function testPrediction() {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();

    const studentRepo = AppDataSource.getRepository(Student);
    const moduleRepo = AppDataSource.getRepository(Module);

    const student = await studentRepo.findOne({ where: {} });
    const module = await moduleRepo.findOne({ where: {} });

    if (!student || !module) {
      console.log('⚠️ No student or module found in database to test with.');
      return;
    }

    console.log(`🧪 Testing prediction for Student: ${student.id} in Module: ${module.id}`);
    
    const prediction = await aiService.predictExamRisk(student.id, module.id);
    
    console.log('✅ Prediction generated and saved:');
    console.log(JSON.stringify(prediction, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

testPrediction();
