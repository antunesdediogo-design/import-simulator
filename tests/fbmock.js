(function(){
  var store = {}; // path -> {id: data}
  var listeners = {}; // path -> [cb]
  function snapFor(path){ var docs = Object.keys(store[path]||{}).map(function(id){ var d=store[path][id]; return { id:id, data:function(){ return JSON.parse(JSON.stringify(d)); } }; });
    return { docs: docs, empty: docs.length===0, metadata:{ fromCache:false, hasPendingWrites:false } }; }
  function emit(path){ (listeners[path]||[]).forEach(function(cb){ setTimeout(function(){ cb(snapFor(path)); }, 5); }); }
  function col(path){ return {
    doc: function(id){ return { set: function(data){ (store[path]=store[path]||{})[id]=JSON.parse(JSON.stringify(data)); window.__writes=(window.__writes||0)+1; emit(path); return Promise.resolve(); },
                                delete: function(){ if(store[path]) delete store[path][id]; emit(path); return Promise.resolve(); } }; },
    onSnapshot: function(cb){ (listeners[path]=listeners[path]||[]).push(cb); setTimeout(function(){ cb(snapFor(path)); }, 20);
      return function(){ listeners[path]=(listeners[path]||[]).filter(function(x){ return x!==cb; }); }; } }; }
  var authCbs=[], user=null;
  var auth = { onAuthStateChanged: function(cb){ authCbs.push(cb); setTimeout(function(){ cb(user); }, 10); },
    signInWithPopup: function(){ user = { email: window.__mockEmail || 'antunes.de.diogo@gmail.com' }; authCbs.forEach(function(cb){ cb(user); }); return Promise.resolve({ user:user }); },
    signOut: function(){ user=null; authCbs.forEach(function(cb){ cb(null); }); return Promise.resolve(); } };
  function authFn(){ return auth; } authFn.GoogleAuthProvider = function(){ this.setCustomParameters=function(){}; };
  window.firebase = { initializeApp: function(){}, firestore: function(){ return { collection: col }; }, auth: authFn };
  window.__fbstore = store;
})();
