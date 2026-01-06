import { AppDataSource } from './config/database';
import { Setting } from './entities/Setting.entity';

async function seedSettings() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const settingRepository = AppDataSource.getRepository(Setting);

    const initialSettings = [
      {
        key: 'campus_name',
        value: 'AI Smart Campus',
        group: 'general',
        description: 'The official name of the campus',
        type: 'text',
      },
      {
        key: 'contact_email',
        value: 'info@smartcampus.edu',
        group: 'general',
        description: 'Main contact email for the institution',
        type: 'text',
      },
      {
        key: 'allow_registration',
        value: 'true',
        group: 'auth',
        description: 'Enable or disable new user registration',
        type: 'boolean',
      },
      {
        key: 'max_students_per_batch',
        value: '50',
        group: 'academic',
        description: 'Maximum number of students allowed in a single batch',
        type: 'number',
      },
    ];

    for (const s of initialSettings) {
      const exists = await settingRepository.findOne({ where: { key: s.key } });
      if (!exists) {
        const setting = settingRepository.create(s);
        await settingRepository.save(setting);
        console.log(`Seeded setting: ${s.key}`);
      }
    }

    console.log('Settings seeding completed.');
  } catch (error) {
    console.error('Error seeding settings:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

seedSettings();
