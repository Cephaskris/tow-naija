const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/3d91360b-6c31-4a1e-9064-faa886f83f86";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
