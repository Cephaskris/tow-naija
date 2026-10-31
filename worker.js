const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/kg2c5pydd6bry04vd0hbnhs6p58haz1q";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
