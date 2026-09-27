import type { TasteProvider } from '#services/taste/types'
import { simklTasteProvider } from '#services/taste/providers/simkl_taste_provider'
import { mediaServerTasteProvider } from '#services/taste/providers/media_server_taste_provider'

/** Every source the For you deck learns from. Order is display order. */
export const tasteProviders: TasteProvider[] = [simklTasteProvider, mediaServerTasteProvider]
