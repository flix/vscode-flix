import { start, stop } from '../engine'

export interface ReadyParams {
	extensionPath: string
}

/**
 * Runs when both client and server are ready.
 * 
 * @param {String} obj.extensionPath - Install path of this extension.
 */
export function handleReady ({ extensionPath }: ReadyParams) {
	start({ extensionPath })
}

export function handleExit () {
	stop()
}
