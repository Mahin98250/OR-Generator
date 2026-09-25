export type OpticalBenchmark = {
  durationMs:number;
  framesObserved:number;
  codesObserved:number;
  uniqueCodes:number;
  averageCodesPerFrame:number;
  averageDecodeMs:number;
  peakDecodeRate:number;
  sustainedDecodeRate:number;
  goodputKbps:number;
  peakGoodputKbps:number;
};

export type BenchmarkSample = {
  at:number;
  bytesRecovered:number;
  codesObserved:number;
};

export function createBenchmarkStart() {
  return performance.now();
}

export function finishBenchmark(
  startedAt:number,
  framesObserved:number,
  codesObserved:number,
  uniqueCodes:number,
  decodeSamples:number[],
  bytesRecovered:number,
  samples:BenchmarkSample[]=[],
):OpticalBenchmark {
  const durationMs=Math.max(1,performance.now()-startedAt);
  const seconds=durationMs/1000;
  const averageCodesPerFrame=framesObserved>0?codesObserved/framesObserved:0;
  const averageDecodeMs=decodeSamples.length?decodeSamples.reduce((sum,v)=>sum+v,0)/decodeSamples.length:0;
  const sustainedDecodeRate=seconds>0?codesObserved/seconds:0;
  const sustainedGoodputKbps=seconds>0?(bytesRecovered/1024)/seconds:0;

  // Decimen's public methodology reports peak as the best >=1 s window.
  // Use the same rule so OptiCode measurements are directly comparable.
  let peakDecodeRate=sustainedDecodeRate;
  let peakGoodputKbps=sustainedGoodputKbps;
  for(let i=0;i<samples.length;i+=1){
    const start=samples[i];
    for(let j=i+1;j<samples.length;j+=1){
      const end=samples[j];
      const elapsed=(end.at-start.at)/1000;
      if(elapsed<1)continue;
      const codes=end.codesObserved-start.codesObserved;
      const bytes=end.bytesRecovered-start.bytesRecovered;
      peakDecodeRate=Math.max(peakDecodeRate,codes/elapsed);
      peakGoodputKbps=Math.max(peakGoodputKbps,(bytes/1024)/elapsed);
      break;
    }
  }

  return {
    durationMs,
    framesObserved,
    codesObserved,
    uniqueCodes,
    averageCodesPerFrame,
    averageDecodeMs,
    peakDecodeRate,
    sustainedDecodeRate,
    goodputKbps:sustainedGoodputKbps,
    peakGoodputKbps,
  };
}
