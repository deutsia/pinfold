import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface LongPressOptions {
	duration?: number;
	onLongPress: () => void;
}

/**
 * Svelte action that fires `onLongPress` after the user holds down a touch or
 * mouse button on the element for `duration` ms (default 500ms). Movement
 * beyond ~10px cancels the gesture so it doesn't trigger during scroll.
 */
export function longpress(node: HTMLElement, options: LongPressOptions) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let startX = 0;
	let startY = 0;
	let fired = false;

	const duration = options.duration ?? 500;

	function cancel() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function start(x: number, y: number) {
		fired = false;
		startX = x;
		startY = y;
		cancel();
		timer = setTimeout(() => {
			fired = true;
			Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
			options.onLongPress();
		}, duration);
	}

	function move(x: number, y: number) {
		if (!timer) return;
		if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) cancel();
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		start(e.touches[0].clientX, e.touches[0].clientY);
	}
	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		move(e.touches[0].clientX, e.touches[0].clientY);
	}
	function handleTouchEnd() {
		cancel();
	}
	function handleContextMenu(e: Event) {
		if (fired) e.preventDefault();
	}
	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		start(e.clientX, e.clientY);
	}
	function handleMouseMove(e: MouseEvent) {
		move(e.clientX, e.clientY);
	}
	function handleMouseUp() {
		cancel();
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: true });
	node.addEventListener('touchend', handleTouchEnd);
	node.addEventListener('touchcancel', handleTouchEnd);
	node.addEventListener('contextmenu', handleContextMenu);
	node.addEventListener('mousedown', handleMouseDown);
	node.addEventListener('mousemove', handleMouseMove);
	node.addEventListener('mouseup', handleMouseUp);
	node.addEventListener('mouseleave', handleMouseUp);

	return {
		destroy() {
			cancel();
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchEnd);
			node.removeEventListener('contextmenu', handleContextMenu);
			node.removeEventListener('mousedown', handleMouseDown);
			node.removeEventListener('mousemove', handleMouseMove);
			node.removeEventListener('mouseup', handleMouseUp);
			node.removeEventListener('mouseleave', handleMouseUp);
		}
	};
}
