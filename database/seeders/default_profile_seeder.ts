import { BaseSeeder } from '@adonisjs/lucid/seeders'
import QualityProfile from '#models/quality_profile'

export default class extends BaseSeeder {
  async run() {
    // Create default quality profiles
    await QualityProfile.createMany([
      {
        name: 'Any',
        cutoff: 1,
        upgradeAllowed: true,
        items: [
          { id: 1, name: 'Unknown', allowed: true },
          { id: 2, name: 'MP3 128', allowed: true },
          { id: 3, name: 'MP3 256', allowed: true },
          { id: 4, name: 'MP3 320', allowed: true },
          { id: 5, name: 'AAC 256', allowed: true },
          { id: 6, name: 'AAC 320', allowed: true },
          { id: 7, name: 'FLAC', allowed: true },
          { id: 8, name: 'FLAC 24bit', allowed: true },
          { id: 9, name: 'WAV', allowed: true },
        ],
      },
      {
        name: 'Lossless',
        cutoff: 7,
        upgradeAllowed: true,
        items: [
          { id: 1, name: 'Unknown', allowed: false },
          { id: 2, name: 'MP3 128', allowed: false },
          { id: 3, name: 'MP3 256', allowed: false },
          { id: 4, name: 'MP3 320', allowed: false },
          { id: 5, name: 'AAC 256', allowed: false },
          { id: 6, name: 'AAC 320', allowed: false },
          { id: 7, name: 'FLAC', allowed: true },
          { id: 8, name: 'FLAC 24bit', allowed: true },
          { id: 9, name: 'WAV', allowed: true },
        ],
      },
      {
        name: 'Standard',
        cutoff: 4,
        upgradeAllowed: true,
        items: [
          { id: 1, name: 'Unknown', allowed: false },
          { id: 2, name: 'MP3 128', allowed: false },
          { id: 3, name: 'MP3 256', allowed: true },
          { id: 4, name: 'MP3 320', allowed: true },
          { id: 5, name: 'AAC 256', allowed: true },
          { id: 6, name: 'AAC 320', allowed: true },
          { id: 7, name: 'FLAC', allowed: true },
          { id: 8, name: 'FLAC 24bit', allowed: true },
          { id: 9, name: 'WAV', allowed: false },
        ],
      },
    ])
  }
}
