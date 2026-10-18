export const supportedMimeTypes=['application/pdf','image/png','image/jpeg','image/webp'];

export function hasSupportedSignature(mime,bytes){
  if(!supportedMimeTypes.includes(mime)||!bytes)return false;
  if(mime==='application/pdf')return bytes.subarray(0,5).toString()==='%PDF-';
  if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216;
  return bytes.subarray(8,12).toString()==='WEBP';
}
