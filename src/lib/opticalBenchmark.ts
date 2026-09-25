export type OpticalBenchmark = {
  durationMs:number;
  framesObserved:number;
  codesObserved:number;
  uniqueCodes:number;
  averageCodesPerFrame:number;
  averageDecodeMs:number;
  peakDecodeRate:number;
  goodputKbps:number;
};

export function createBenchmarkStart() {
  return performance.now();
}

export function finishBenchmark(startedAt:number, framesObserved:number, codesObserved:number, uniqueCodes:number, decodeSamples:number[], bytesRecovered:number):OpticalBenchmark {
  const durationMs=Math.max(1,performance.now()-startedAt);
  const seconds=durationMs/1000;
  const averageCodesPerFrame=framesObserved>0?codesObserved/framesObserved:0;
  const averageDecodeMs=decodeSamples.length?decodeSamples.reduce((sum,v)=>sum+v,0)/decodeSamples.length:0;
  const peakDecodeRate=seconds>0?codesObserved/seconds:0;
  const goodputKbps=seconds>0?(bytesRecovered/1024)/seconds:0;
  return {durationMs,framesObserved,codesObserved,uniqueCodes,averageCodesPerFrame,averageDecodeMs,peakDecodeRate,goodputKbps};
}
