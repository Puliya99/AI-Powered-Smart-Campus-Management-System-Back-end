import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Setting } from '../entities/Setting.entity';

export class SettingController {
  private settingRepository = AppDataSource.getRepository(Setting);

  // Get all settings
  async getAllSettings(req: Request, res: Response) {
    try {
      const { group } = req.query;
      
      const queryBuilder = this.settingRepository.createQueryBuilder('setting');

      if (group) {
        queryBuilder.where('setting.group = :group', { group });
      }

      const settings = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: { settings },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch settings',
      });
    }
  }

  // Get setting by key
  async getSettingByKey(req: Request, res: Response) {
    try {
      const { key } = req.params;

      const setting = await this.settingRepository.findOne({
        where: { key },
      });

      if (!setting) {
        return res.status(404).json({
          status: 'error',
          message: 'Setting not found',
        });
      }

      res.json({
        status: 'success',
        data: { setting },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch setting',
      });
    }
  }

  // Create or update setting
  async upsertSetting(req: Request, res: Response) {
    try {
      const { key, value, group, description, type } = req.body;

      let setting = await this.settingRepository.findOne({
        where: { key },
      });

      if (setting) {
        // Update
        if (value !== undefined) setting.value = value;
        if (group !== undefined) setting.group = group;
        if (description !== undefined) setting.description = description;
        if (type !== undefined) setting.type = type;
      } else {
        // Create
        setting = new Setting();
        setting.key = key;
        setting.value = value;
        setting.group = group || 'general';
        setting.description = description || '';
        setting.type = type || 'text';
      }

      await this.settingRepository.save(setting);

      res.json({
        status: 'success',
        message: 'Setting saved successfully',
        data: { setting },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to save setting',
      });
    }
  }

  // Update multiple settings at once
  async updateMultipleSettings(req: Request, res: Response) {
    try {
      const { settings } = req.body; // Array of { key, value }

      if (!Array.isArray(settings)) {
        return res.status(400).json({
          status: 'error',
          message: 'Settings must be an array',
        });
      }

      for (const item of settings) {
        const { key, value } = item;
        let setting = await this.settingRepository.findOne({ where: { key } });
        if (setting) {
          setting.value = value;
          await this.settingRepository.save(setting);
        }
      }

      res.json({
        status: 'success',
        message: 'Settings updated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update settings',
      });
    }
  }

  // Delete setting
  async deleteSetting(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const setting = await this.settingRepository.findOne({ where: { id } });

      if (!setting) {
        return res.status(404).json({
          status: 'error',
          message: 'Setting not found',
        });
      }

      await this.settingRepository.remove(setting);

      res.json({
        status: 'success',
        message: 'Setting deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete setting',
      });
    }
  }
}

export default new SettingController();
