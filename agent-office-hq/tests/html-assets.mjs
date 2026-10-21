// Match script identity independently of a cache-busting query or relative URL.
export function scriptPaths(html){
 return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
  .map(match=>new URL(match[1],'https://office-hq.example/app/').pathname.split('/').pop());
}
