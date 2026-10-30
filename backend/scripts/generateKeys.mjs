import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });

  const privateKeyString = await exportPKCS8(privateKey);
  const jwk = await exportJWK(publicKey);
  const jwks = JSON.stringify({ keys: [{ ...jwk, alg: "RS256", use: "sig" }] });

  console.log("\n=== Generated Convex Auth Keys ===");
  console.log("\nJWT_PRIVATE_KEY:\n" + privateKeyString);
  console.log("\nJWKS:\n" + jwks);
  console.log("\nTo set these on your deployment, run:\n");
  console.log(`npx convex env set JWT_PRIVATE_KEY "${privateKeyString.replace(/\n/g, "\\n")}"`);
  console.log(`npx convex env set JWKS '${jwks}'`);
}

main().catch(console.error);
