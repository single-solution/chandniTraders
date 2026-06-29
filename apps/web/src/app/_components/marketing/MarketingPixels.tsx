import Script from "next/script";

/**
 * Renders the analytics + ad-network pixels that are configured in the
 * admin "Marketing" settings. Each block is a no-op when the corresponding
 * ID is empty, so a brand-new install ships zero third-party scripts.
 *
 * Notes:
 * - GTM and GA4 are kept independent so an admin can run GTM as a wrapper
 *   *or* drop in a bare GA4 measurement ID without spinning up a tag
 *   manager — both, neither, or one are all valid.
 * - Loading strategy is `lazyOnload` so pixel JS waits until after the
 *   browser's `load` event fires. That keeps the pixels off the main
 *   thread between FCP and TTI (where Total Blocking Time accumulates).
 *   Side effect: the first `PageView` ping fires ~1–2 s later than with
 *   `afterInteractive`. The pixels' built-in queue (`fbq` `.queue`, GA's
 *   `dataLayer`, TikTok's `ttq.queue`) captures any events that happen
 *   before the loader script arrives, so nothing is lost — only delayed.
 */
export interface MarketingPixelsProps {
	metaPixelId?: string;
	googleAnalyticsId?: string;
	googleTagManagerId?: string;
	tiktokPixelId?: string;
}

const META_ID_PATTERN = /^\d{6,20}$/;
const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const TIKTOK_ID_PATTERN = /^[A-Z0-9]{16,40}$/;

function clean(value: string | undefined): string {
	return value?.trim() ?? "";
}

export function MarketingPixels({ metaPixelId, googleAnalyticsId, googleTagManagerId, tiktokPixelId }: MarketingPixelsProps) {
	const meta = clean(metaPixelId);
	const ga4 = clean(googleAnalyticsId).toUpperCase();
	const gtm = clean(googleTagManagerId).toUpperCase();
	const tiktok = clean(tiktokPixelId).toUpperCase();

	// Reject obvious typos at the boundary so we never inject malformed IDs
	// into a third-party SDK (which can throw inline and block other scripts).
	const validMeta = META_ID_PATTERN.test(meta) ? meta : "";
	const validGa4 = GA4_ID_PATTERN.test(ga4) ? ga4 : "";
	const validGtm = GTM_ID_PATTERN.test(gtm) ? gtm : "";
	const validTiktok = TIKTOK_ID_PATTERN.test(tiktok) ? tiktok : "";

	return (
		<>
			{validGtm ? (
				<Script id="gtm-loader" strategy="lazyOnload">
					{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${validGtm}');`}
				</Script>
			) : null}

			{validGa4 ? (
				<>
					<Script id="ga4-loader" src={`https://www.googletagmanager.com/gtag/js?id=${validGa4}`} strategy="lazyOnload" />
					<Script id="ga4-init" strategy="lazyOnload">
						{`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
gtag('js', new Date());
gtag('config', '${validGa4}');`}
					</Script>
				</>
			) : null}

			{validMeta ? (
				<Script id="meta-pixel" strategy="lazyOnload">
					{`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${validMeta}');
fbq('track', 'PageView');`}
				</Script>
			) : null}

			{validTiktok ? (
				<Script id="tiktok-pixel" strategy="lazyOnload">
					{`!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${validTiktok}');
  ttq.page();
}(window, document, 'ttq');`}
				</Script>
			) : null}
		</>
	);
}

/**
 * `<noscript>` GTM iframe fallback. Must render directly inside `<body>` to
 * follow Google's recommended snippet — exported separately so the layout
 * can place it at the top of <body> while the loader script lives in <head>.
 */
export function MarketingPixelsNoScript({ googleTagManagerId }: Pick<MarketingPixelsProps, "googleTagManagerId">) {
	const gtm = clean(googleTagManagerId).toUpperCase();
	if (!GTM_ID_PATTERN.test(gtm)) return null;
	return (
		<noscript>
			<iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
		</noscript>
	);
}
