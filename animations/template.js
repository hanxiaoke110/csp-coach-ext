// Animation template engine - loaded by animation HTML files
(function() {
  var dataEl = document.getElementById('steps-data');
  if (!dataEl) return;
  var steps = JSON.parse(dataEl.textContent);
  var totalSteps = steps.length;
  var currentStep = 0;
  var autoTimer = null;
  var speechReady = false;
  var ttsVoice = dataEl.getAttribute('data-voice') || 'auto';

  document.getElementById('totalSteps').textContent = totalSteps;

  // Preload voices
  var voices = speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = function() { voices = speechSynthesis.getVoices(); };

  function speak(text) {
    if (!speechReady || !text || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    u.pitch = 1.0;
    var v = null;
    if (ttsVoice && ttsVoice !== 'auto' && ttsVoice !== 'browser') {
      v = voices.find(function(x) { return x.name === ttsVoice; });
    }
    if (!v) {
      v = voices.find(function(x) { return x.lang === 'zh-CN'; }) ||
          voices.find(function(x) { return x.lang.startsWith('zh'); });
    }
    if (v) u.voice = v;
    try { speechSynthesis.speak(u); } catch(e) {}
  }

  function autoNext() {
    if (currentStep < totalSteps - 1) showStep(currentStep + 1);
    else { clearInterval(autoTimer); autoTimer = null; document.getElementById('playBtn').textContent = '▶ 自动播放'; }
  }

  function showStep(idx) {
    currentStep = idx;
    var stage = document.getElementById('stage');
    gsap.to(stage, {opacity:0, y:-15, duration:.15, onComplete:function(){
      stage.innerHTML = steps[idx].html;
      gsap.fromTo(stage, {opacity:0, y:15, scale:.95}, {opacity:1, y:0, scale:1, duration:.35, ease:'back.out(1.5)'});
      stage.querySelectorAll('.var-box,.result-box,.io-card,.arrow,.block').forEach(function(el,i){
        el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'bounceIn .4s '+ (i*0.05) +'s both';
      });
    }});
    document.getElementById('indicator').textContent = (idx+1)+' / '+totalSteps;
    document.getElementById('progressBar').style.width = ((idx+1)/totalSteps*100)+'%';
    document.getElementById('prevBtn').disabled = idx===0;
    document.getElementById('nextBtn').disabled = idx===totalSteps-1;
    speak(steps[idx].narration);
  }

  document.getElementById('startBtn').onclick = function(){
    speechReady = true;
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('speakBadge').style.display = 'inline-block';
    if (steps[0] && steps[0].narration) speak(steps[0].narration);
  };

  document.getElementById('prevBtn').onclick = function(){ if(currentStep>0) showStep(currentStep-1); };
  document.getElementById('nextBtn').onclick = function(){ if(currentStep<totalSteps-1) showStep(currentStep+1); };
  document.getElementById('playBtn').onclick = function(){
    if(autoTimer){ clearInterval(autoTimer); autoTimer=null; this.textContent='▶ 自动播放'; return; }
    this.textContent='⏸ 暂停';
    if(currentStep===totalSteps-1) currentStep=-1;
    autoTimer = setInterval(autoNext,2500);
  };
  document.getElementById('resetBtn').onclick = function(){
    if(autoTimer){ clearInterval(autoTimer); autoTimer=null; document.getElementById('playBtn').textContent='▶ 自动播放'; }
    speechSynthesis.cancel(); showStep(0);
  };

  showStep(0);
})();
