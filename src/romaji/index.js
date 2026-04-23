/**
 * Public entry for the romaji layer — emitter + system presets.
 *
 * Consumers: `import { emitRomaji, stripMacrons, macronToCircumflex } from 'kusanaji/romaji'`.
 */
export { emitRomaji } from './emit.js'
export {
    JAPANESE_PRESET_BY_SYSTEM,
    WAPURO_CONFIG,
    macronToCircumflex,
    stripMacrons,
} from './systems.js'
