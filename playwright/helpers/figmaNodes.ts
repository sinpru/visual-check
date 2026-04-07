/**
 * Mapping of testName → Figma nodeId.
 *
 * This is the source of truth for which Figma frame corresponds to each visual test.
 * When adding a new visual test, add its mapping here so that UPDATE_BASELINE=true
 * can fetch the correct design from Figma.
 *
 * Format: 'test-name': 'nodeId'
 * You can find the nodeId in Figma by selecting the frame and looking at the URL:
 *   https://www.figma.com/file/{fileKey}?node-id=123:456
 *   → nodeId is '123:456'
 */
export const figmaNodes: Record<string, string> = {
	'homepage-hero': '123:456',
	'homepage-nav': '123:789',
};
