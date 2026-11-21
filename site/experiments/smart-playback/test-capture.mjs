// Only explicitly loaded by the local output test harness; never by the page.
class Capture extends AudioWorkletProcessor{process(inputs,outputs){const x=inputs[0],y=outputs[0];for(let c=0;c<y.length;c++)y[c].set(x[c]||new Float32Array(y[c].length));this.port.postMessage({left:Array.from(y[0]),right:Array.from(y[1])});return true}}registerProcessor('capture',Capture);
