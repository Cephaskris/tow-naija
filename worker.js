const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/c6136f81-c754-41da-95fe-f49bd0a5a119";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
