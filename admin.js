// ===== 内容管理系统 (CMS) =====
// 访问方式：Ctrl+Shift+A 或 连续点击页脚 Logo 5 次
// 首次使用需设置管理密码，密码以 SHA-256 哈希存储
(function () {
  'use strict';

  // ===== 常量 =====
  const STORAGE_KEY = 'portfolio_site_data';
  const SESSION_KEY = 'portfolio_admin_auth';
  const PWD_KEY = 'portfolio_admin_pwd_hash';
  const PWD_INIT_KEY = 'portfolio_pwd_initialized';
  const IDB_NAME = 'PortfolioCMS';
  const IDB_STORE = 'siteData';
  const IDB_VERSION = 1;

  // ===== 默认站点数据 =====
  const DEFAULT_DATA = {
    hero: {
      subtitle: 'Photography Portfolio',
      title: '用镜头<br>记录世界',
      desc: '每一帧光影，都是一段故事',
      bgImage: 'https://picsum.photos/seed/hero-camera/1920/1080'
    },
    about: {
      name: '三四 / T.F',
      role: '独立摄影师 · 视觉创作者',
      bio: [
        '一位喜欢到处拍拍的摄影师。擅长风光、街拍、人像与自然摄影，相信好的照片不只是记录，更是情感与光影的对话。',
        '喜欢背着相机穿梭在城市与自然之间，用独特的视角捕捉那些稍纵即逝的瞬间。每一次按下快门，都是与世界的一次深度对话。'
      ],
      photo: '',
      stats: [
        { number: '10+', label: '年摄影经验' },
        { number: '5000+', label: '作品产出' },
        { number: '20+', label: '展览/合作' }
      ]
    },
    contact: {
      email: '484757634@qq.com',
      phone: '14727607114',
      location: '中国',
      wechatQR: ''
    },
    gallery: [
      { id: 1, title: '山间晨雾', desc: '风光 · 2024', category: 'landscape', image: 'https://picsum.photos/seed/mountain/800/600', size: '' },
      { id: 2, title: '城市脉搏', desc: '街拍 · 2024', category: 'street', image: 'https://picsum.photos/seed/city88/600/900', size: 'tall' },
      { id: 3, title: '光影肖像', desc: '人像 · 2024', category: 'portrait', image: 'https://picsum.photos/seed/face22/800/600', size: '' },
      { id: 4, title: '密林深处', desc: '自然 · 2023', category: 'nature', image: 'https://picsum.photos/seed/forest7/800/600', size: '' },
      { id: 5, title: '海天一色', desc: '风光 · 2023', category: 'landscape', image: 'https://picsum.photos/seed/ocean55/1200/600', size: 'wide' },
      { id: 6, title: '巷弄时光', desc: '街拍 · 2023', category: 'street', image: 'https://picsum.photos/seed/alley9/800/600', size: '' },
      { id: 7, title: '花开无声', desc: '自然 · 2023', category: 'nature', image: 'https://picsum.photos/seed/flower3/600/900', size: 'tall' },
      { id: 8, title: '街角故事', desc: '人像 · 2023', category: 'portrait', image: 'https://picsum.photos/seed/people8/800/600', size: '' },
      { id: 9, title: '落日余晖', desc: '风光 · 2023', category: 'landscape', image: 'https://picsum.photos/seed/sunset12/800/600', size: '' }
    ]
  };

  // ===== 状态 =====
  let siteData = null;
  let isLoggedIn = false;

  // ===== 密码哈希（SHA-256） =====
  async function hashPassword(pwd) {
    var encoder = new TextEncoder();
    var data = encoder.encode(pwd + '_tf_salt_2024');
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function isPasswordInitialized() {
    var stored = localStorage.getItem(PWD_INIT_KEY);
    if (stored === 'true') return true;
    // 兼容旧版：如果存在明文密码，自动迁移为哈希
    var oldPwd = localStorage.getItem('portfolio_admin_pwd');
    if (oldPwd) {
      var hash = await hashPassword(oldPwd);
      localStorage.setItem(PWD_KEY, hash);
      localStorage.setItem(PWD_INIT_KEY, 'true');
      localStorage.removeItem('portfolio_admin_pwd');
      return true;
    }
    return false;
  }

  async function verifyPassword(pwd) {
    var storedHash = localStorage.getItem(PWD_KEY);
    if (!storedHash) return false;
    var inputHash = await hashPassword(pwd);
    return inputHash === storedHash;
  }

  // ===== 初始化 =====
  async function init() {
    // 初始化 IndexedDB
    var db = await openIDB();
    if (db) {
      idbReady = true;
      // 检查 IndexedDB 是否已有数据
      var idbData = await idbGet(db);
      if (!idbData) {
        // 首次使用 IndexedDB，从 localStorage 迁移旧数据
        try {
          var lsData = localStorage.getItem(STORAGE_KEY);
          if (lsData) {
            await idbSet(db, JSON.parse(lsData));
            console.log('已从 localStorage 迁移数据到 IndexedDB');
          }
        } catch (e) {
          console.warn('数据迁移失败:', e);
        }
      }
    }

    // 加载数据：优先 IndexedDB，其次 localStorage
    if (idbReady) {
      var stored = await idbGet(db);
      if (stored) {
        siteData = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), stored);
      } else {
        siteData = loadData(); // fallback to localStorage
      }
    } else {
      siteData = loadData();
    }

    applyData();
    setupAccess();
  }

  // ===== 数据管理（IndexedDB 为主，localStorage 降级） =====
  let idbReady = false;

  function openIDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { console.warn('IndexedDB 打开失败:', e); resolve(null); };
    });
  }

  function idbGet(db) {
    return new Promise(function (resolve) {
      if (!db) { resolve(null); return; }
      var tx = db.transaction(IDB_STORE, 'readonly');
      var store = tx.objectStore(IDB_STORE);
      var req = store.get(STORAGE_KEY);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
    });
  }

  function idbSet(db, data) {
    return new Promise(function (resolve) {
      if (!db) { resolve(false); return; }
      var tx = db.transaction(IDB_STORE, 'readwrite');
      var store = tx.objectStore(IDB_STORE);
      var req = store.put(data, STORAGE_KEY);
      req.onsuccess = function () { resolve(true); };
      req.onerror = function () { resolve(false); };
    });
  }

  function loadData() {
    try {
      // 优先从 localStorage 读取（同步，用于首次渲染）
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
      }
    } catch (e) {
      console.warn('localStorage 读取失败:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function saveData() {
    return new Promise(async function (resolve) {
      var json = JSON.stringify(siteData);
      var sizeMB = (new Blob([json]).size / 1024 / 1024).toFixed(2);
      console.log('数据大小: ' + sizeMB + ' MB');

      // 尝试 IndexedDB（无大小限制）
      if (idbReady) {
        var db = await openIDB();
        if (db) {
          var ok = await idbSet(db, siteData);
          if (ok) {
            // 同步清理 localStorage 中的旧数据，释放空间
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            resolve(true);
            return;
          }
        }
      }

      // 降级到 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, json);
        resolve(true);
      } catch (e) {
        console.error('保存失败（localStorage 也满了）:', e);
        resolve(false);
      }
    });
  }

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ===== 应用数据到页面 =====
  function applyData() {
    // Hero
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const heroTitle = document.querySelector('.hero-title');
    const heroDesc = document.querySelector('.hero-desc');
    const hero = document.querySelector('.hero');

    if (heroSubtitle) heroSubtitle.textContent = siteData.hero.subtitle;
    if (heroTitle) heroTitle.innerHTML = siteData.hero.title;
    if (heroDesc) heroDesc.textContent = siteData.hero.desc;
    if (hero && siteData.hero.bgImage) {
      hero.style.backgroundImage = "url('" + siteData.hero.bgImage + "')";
    }

    // About
    const aboutName = document.querySelector('.about-name');
    const aboutRole = document.querySelector('.about-role');
    const aboutBios = document.querySelectorAll('.about-bio');
    const aboutPlaceholder = document.querySelector('.about-image-placeholder');
    const statsContainer = document.querySelector('.about-stats');

    if (aboutName) aboutName.textContent = siteData.about.name;
    if (aboutRole) aboutRole.textContent = siteData.about.role;

    siteData.about.bio.forEach(function (text, i) {
      if (aboutBios[i]) aboutBios[i].textContent = text;
    });

    // Personal photo
    if (aboutPlaceholder && siteData.about.photo) {
      aboutPlaceholder.innerHTML = '';
      aboutPlaceholder.style.backgroundImage = "url('" + siteData.about.photo + "')";
      aboutPlaceholder.style.backgroundSize = 'cover';
      aboutPlaceholder.style.backgroundPosition = 'center';
      aboutPlaceholder.classList.add('has-photo');
    }

    // Stats
    if (statsContainer && siteData.about.stats) {
      statsContainer.innerHTML = siteData.about.stats.map(function (s) {
        return '<div class="stat"><span class="stat-number">' + s.number + '</span><span class="stat-label">' + s.label + '</span></div>';
      }).join('');
    }

    // Contact
    const contactItems = document.querySelectorAll('.contact-item');
    if (contactItems[0]) contactItems[0].querySelector('p').textContent = siteData.contact.email;
    if (contactItems[1]) contactItems[1].querySelector('p').textContent = siteData.contact.phone;
    if (contactItems[2]) contactItems[2].querySelector('p').textContent = siteData.contact.location;

    // WeChat QR
    const qrPlaceholder = document.getElementById('qrPlaceholder');
    if (qrPlaceholder && siteData.contact.wechatQR) {
      qrPlaceholder.innerHTML = '<img src="' + siteData.contact.wechatQR + '" alt="微信二维码" style="width:100%;height:100%;object-fit:contain;">';
      qrPlaceholder.style.border = 'none';
    }

    // Gallery
    renderGallery();
  }

  function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = siteData.gallery.map(function (item) {
      return '<div class="gallery-item ' + (item.size || '') + '" data-category="' + item.category + '">' +
        '<div class="gallery-img" style="background-image: url(\'' + item.image + '\')"></div>' +
        '<div class="gallery-overlay"><h3>' + item.title + '</h3><p>' + item.desc + '</p></div>' +
        '</div>';
    }).join('');

    bindGalleryEvents();
  }

  function bindGalleryEvents() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDesc = document.getElementById('lightboxDesc');

    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const img = item.querySelector('.gallery-img');
        const title = item.querySelector('h3').textContent;
        const desc = item.querySelector('p').textContent;
        const bgUrl = img.style.backgroundImage;
        const url = bgUrl.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
        const largeUrl = url.replace(/\/\d+\/\d+$/, '/1600/1200');

        lightboxImg.src = largeUrl;
        lightboxTitle.textContent = title;
        lightboxDesc.textContent = desc;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    // Re-observe for scroll animations
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    galleryItems.forEach(function (el) {
      el.classList.add('fade-in');
      observer.observe(el);
    });
  }

  // ===== 管理员访问 =====
  function setupAccess() {
    // Check session
    var session = sessionStorage.getItem(SESSION_KEY);
    if (session === 'true') {
      isLoggedIn = true;
      showAdminIndicator();
    }

    // Keyboard shortcut: Ctrl+Shift+A
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isLoggedIn) {
          openAdmin();
        } else {
          showLogin();
        }
      }
    });

    // 5-click footer logo
    var footerLogo = document.querySelector('.footer-logo');
    if (footerLogo) {
      var clickCount = 0;
      var clickTimer = null;
      footerLogo.addEventListener('click', function () {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(function () { clickCount = 0; }, 1000);
        if (clickCount >= 5) {
          clickCount = 0;
          if (isLoggedIn) {
            openAdmin();
          } else {
            showLogin();
          }
        }
      });
    }
  }

  // ===== 登录 =====
  async function showLogin() {
    var modal = document.getElementById('adminLoginModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminLoginModal';
      modal.className = 'admin-modal';
      document.body.appendChild(modal);
    }

    // 检查是否需要首次设置密码
    var initialized = localStorage.getItem(PWD_INIT_KEY) === 'true';

    if (initialized) {
      // 登录界面
      modal.innerHTML =
        '<div class="admin-modal-box">' +
          '<h3>\uD83D\uDD10 管理员验证</h3>' +
          '<p class="admin-modal-desc">请输入管理密码以进入编辑模式</p>' +
          '<input type="password" id="adminPwdInput" placeholder="管理密码" autocomplete="off">' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn admin-btn-primary" id="adminLoginBtn">确认</button>' +
            '<button class="admin-btn admin-btn-ghost" id="adminLoginCancel">取消</button>' +
          '</div>' +
        '</div>';

      document.getElementById('adminLoginBtn').addEventListener('click', attemptLogin);
      document.getElementById('adminLoginCancel').addEventListener('click', closeLogin);
      document.getElementById('adminPwdInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') attemptLogin();
      });
    } else {
      // 首次设置密码界面
      modal.innerHTML =
        '<div class="admin-modal-box">' +
          '<h3>\uD83D\uDD10 初始化管理密码</h3>' +
          '<p class="admin-modal-desc">首次使用，请设置一个管理密码（至少6位）</p>' +
          '<input type="password" id="adminNewPwdInit" placeholder="设置密码（至少6位）" autocomplete="new-password" style="margin-bottom:10px">' +
          '<input type="password" id="adminConfirmPwdInit" placeholder="确认密码" autocomplete="new-password">' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn admin-btn-primary" id="adminInitPwdBtn">设置密码</button>' +
            '<button class="admin-btn admin-btn-ghost" id="adminLoginCancel">取消</button>' +
          '</div>' +
        '</div>';

      document.getElementById('adminInitPwdBtn').addEventListener('click', initializePassword);
      document.getElementById('adminLoginCancel').addEventListener('click', closeLogin);
      document.getElementById('adminConfirmPwdInit').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') initializePassword();
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeLogin();
    });

    modal.classList.add('active');
    var firstInput = modal.querySelector('input');
    if (firstInput) {
      firstInput.value = '';
      setTimeout(function () { firstInput.focus(); }, 100);
    }
  }

  async function initializePassword() {
    var pwd = document.getElementById('adminNewPwdInit').value;
    var confirm = document.getElementById('adminConfirmPwdInit').value;

    if (!pwd || pwd.length < 6) {
      showToast('密码长度至少 6 位');
      return;
    }
    if (pwd !== confirm) {
      showToast('两次输入的密码不一致');
      return;
    }

    var hash = await hashPassword(pwd);
    localStorage.setItem(PWD_KEY, hash);
    localStorage.setItem(PWD_INIT_KEY, 'true');

    isLoggedIn = true;
    sessionStorage.setItem(SESSION_KEY, 'true');
    closeLogin();
    showAdminIndicator();
    openAdmin();
    showToast('\u2705 密码设置成功，请牢记！');
  }

  async function attemptLogin() {
    var input = document.getElementById('adminPwdInput');
    var pwd = input.value.trim();

    var ok = await verifyPassword(pwd);
    if (ok) {
      isLoggedIn = true;
      sessionStorage.setItem(SESSION_KEY, 'true');
      closeLogin();
      showAdminIndicator();
      openAdmin();
    } else {
      input.style.borderColor = '#e74c3c';
      input.value = '';
      input.placeholder = '密码错误，请重试';
      input.classList.add('admin-input-error');
      setTimeout(function () {
        input.style.borderColor = '';
        input.placeholder = '管理密码';
        input.classList.remove('admin-input-error');
      }, 2000);
    }
  }

  function closeLogin() {
    var modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.remove('active');
  }

  // ===== 管理员指示器 =====
  function showAdminIndicator() {
    var indicator = document.getElementById('adminIndicator');
    if (!indicator) {
      indicator = document.createElement('button');
      indicator.id = 'adminIndicator';
      indicator.className = 'admin-indicator';
      indicator.innerHTML = '\u2699';
      indicator.title = '打开内容管理 (Ctrl+Shift+A)';
      indicator.addEventListener('click', openAdmin);
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  }

  // ===== 管理面板 =====
  function openAdmin() {
    var panel = document.getElementById('adminPanel');
    if (!panel) {
      createAdminPanel();
      panel = document.getElementById('adminPanel');
    }
    populateForms();
    panel.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAdmin() {
    var panel = document.getElementById('adminPanel');
    if (panel) panel.classList.remove('active');
    document.body.style.overflow = '';
  }

  function createAdminPanel() {
    var panel = document.createElement('div');
    panel.id = 'adminPanel';
    panel.className = 'admin-panel';
    panel.innerHTML =
      '<div class="admin-panel-inner">' +
        '<div class="admin-panel-header">' +
          '<h3>\uD83D\uDCDD 内容管理</h3>' +
          '<button class="admin-close-btn" id="adminCloseBtn">\u00D7</button>' +
        '</div>' +

        '<div class="admin-tabs" id="adminTabs">' +
          '<button class="admin-tab active" data-tab="basic">基本信息</button>' +
          '<button class="admin-tab" data-tab="contact">联系方式</button>' +
          '<button class="admin-tab" data-tab="hero">首屏设置</button>' +
          '<button class="admin-tab" data-tab="gallery">作品管理</button>' +
          '<button class="admin-tab" data-tab="media">图片上传</button>' +
          '<button class="admin-tab" data-tab="settings">系统设置</button>' +
        '</div>' +

        '<div class="admin-panel-body">' +
          // 基本信息
          '<div class="admin-tab-content active" id="tab-basic">' +
            '<div class="admin-form-group"><label>姓名</label><input type="text" id="adminName" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>角色 / 头衔</label><input type="text" id="adminRole" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>个人简介（第一段）</label><textarea id="adminBio1" class="admin-textarea" rows="3"></textarea></div>' +
            '<div class="admin-form-group"><label>个人简介（第二段）</label><textarea id="adminBio2" class="admin-textarea" rows="3"></textarea></div>' +
            '<div class="admin-form-group"><label>数据统计</label><div id="adminStats" class="admin-stats-editor"></div><button class="admin-btn admin-btn-outline" id="adminAddStat">+ 添加统计项</button></div>' +
          '</div>' +

          // 联系方式
          '<div class="admin-tab-content" id="tab-contact">' +
            '<div class="admin-form-group"><label>邮箱</label><input type="email" id="adminEmail" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>电话</label><input type="text" id="adminPhone" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>所在地</label><input type="text" id="adminLocation" class="admin-input"></div>' +
          '</div>' +

          // 首屏设置
          '<div class="admin-tab-content" id="tab-hero">' +
            '<div class="admin-form-group"><label>英文副标题</label><input type="text" id="adminHeroSubtitle" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>主标题（换行请用回车）</label><textarea id="adminHeroTitle" class="admin-textarea" rows="2"></textarea></div>' +
            '<div class="admin-form-group"><label>描述文字</label><input type="text" id="adminHeroDesc" class="admin-input"></div>' +
            '<div class="admin-form-group"><label>背景图片 URL</label><input type="text" id="adminHeroBg" class="admin-input" placeholder="https://..."><div id="adminHeroBgPreview" class="admin-img-preview"></div></div>' +
          '</div>' +

          // 作品管理
          '<div class="admin-tab-content" id="tab-gallery">' +
            '<div class="admin-gallery-header"><p class="admin-gallery-count">共 <span id="galleryCount">0</span> 个作品</p><button class="admin-btn admin-btn-primary" id="adminAddGallery">+ 添加作品</button></div>' +
            '<div id="adminGalleryList" class="admin-gallery-list"></div>' +
          '</div>' +

          // 图片上传
          '<div class="admin-tab-content" id="tab-media">' +
            '<div class="admin-form-group"><label>个人照片</label><p class="admin-hint">建议正方形或竖版照片，显示为 3:4 比例</p><div id="adminPhotoPreview" class="admin-media-preview"></div><input type="file" id="adminPhotoInput" accept="image/*" class="admin-file-input"><label for="adminPhotoInput" class="admin-file-label">选择图片</label><button class="admin-btn admin-btn-outline admin-btn-danger-text" id="adminRemovePhoto" style="margin-top:8px;">移除照片</button></div>' +
            '<div class="admin-form-group" style="margin-top:24px;"><label>微信二维码</label><p class="admin-hint">建议正方形图片</p><div id="adminQRPreview" class="admin-media-preview"></div><input type="file" id="adminQRInput" accept="image/*" class="admin-file-input"><label for="adminQRInput" class="admin-file-label">选择图片</label><button class="admin-btn admin-btn-outline admin-btn-danger-text" id="adminRemoveQR" style="margin-top:8px;">移除二维码</button></div>' +
          '</div>' +

          // 系统设置
          '<div class="admin-tab-content" id="tab-settings">' +
            '<div class="admin-form-group"><label>修改管理密码</label><input type="password" id="adminNewPwd" class="admin-input" placeholder="输入新密码"></div>' +
            '<div class="admin-form-group"><label>确认新密码</label><input type="password" id="adminConfirmPwd" class="admin-input" placeholder="再次输入新密码"></div>' +
            '<button class="admin-btn admin-btn-primary" id="adminChangePwd">修改密码</button>' +
            '<div class="admin-form-group" style="margin-top:32px;"><label>数据备份</label><p class="admin-hint">导出所有网站内容为 JSON 文件，可用于备份或迁移到其他设备</p><div class="admin-settings-actions"><button class="admin-btn admin-btn-outline" id="adminExport">\uD83D\uDCE5 导出数据</button><button class="admin-btn admin-btn-outline" id="adminImport">\uD83D\uDCE4 导入数据</button><input type="file" id="adminImportFile" accept=".json" class="admin-file-input" style="display:none;"></div></div>' +
            '<div class="admin-form-group" style="margin-top:32px;"><label>危险操作</label><button class="admin-btn admin-btn-danger" id="adminReset">\uD83D\uDDD1 恢复默认内容</button></div>' +
          '</div>' +
        '</div>' +

        '<div class="admin-panel-footer">' +
          '<button class="admin-btn admin-btn-primary admin-btn-save" id="adminSaveBtn">\uD83D\uDCBE 保存所有更改</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(panel);

    // Close
    document.getElementById('adminCloseBtn').addEventListener('click', closeAdmin);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closeAdmin();
    });

    // Tabs
    panel.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });

    // Save
    document.getElementById('adminSaveBtn').addEventListener('click', saveAll);

    // Stats
    document.getElementById('adminAddStat').addEventListener('click', addStatField);

    // Gallery
    document.getElementById('adminAddGallery').addEventListener('click', function () { showGalleryEditor(); });
    document.getElementById('adminGalleryList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') showGalleryEditor(id);
      if (btn.dataset.action === 'delete') deleteGalleryItem(id);
    });

    // Media uploads
    document.getElementById('adminPhotoInput').addEventListener('change', function (e) { handleImageUpload(e, 'photo'); });
    document.getElementById('adminQRInput').addEventListener('change', function (e) { handleImageUpload(e, 'qr'); });
    document.getElementById('adminRemovePhoto').addEventListener('click', function () {
      siteData.about.photo = '';
      updateMediaPreviews();
    });
    document.getElementById('adminRemoveQR').addEventListener('click', function () {
      siteData.contact.wechatQR = '';
      updateMediaPreviews();
    });

    // Hero bg preview
    document.getElementById('adminHeroBg').addEventListener('input', function (e) {
      var preview = document.getElementById('adminHeroBgPreview');
      if (e.target.value) {
        preview.innerHTML = '<img src="' + e.target.value + '" alt="预览" onerror="this.parentElement.innerHTML=\'<p class=admin-preview-error>图片加载失败</p>\'">';
      } else {
        preview.innerHTML = '';
      }
    });

    // Settings
    document.getElementById('adminChangePwd').addEventListener('click', changePassword);
    document.getElementById('adminExport').addEventListener('click', exportData);
    document.getElementById('adminImport').addEventListener('click', function () { document.getElementById('adminImportFile').click(); });
    document.getElementById('adminImportFile').addEventListener('change', importData);
    document.getElementById('adminReset').addEventListener('click', resetData);

    // ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAdmin();
        closeLogin();
        closeGalleryEditor();
      }
    });
  }

  // ===== Tab 切换 =====
  function switchTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.admin-tab-content').forEach(function (t) { t.classList.remove('active'); });
    var tabBtn = document.querySelector('.admin-tab[data-tab="' + tabId + '"]');
    var tabContent = document.getElementById('tab-' + tabId);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    if (tabId === 'gallery') renderGalleryList();
    if (tabId === 'media') updateMediaPreviews();
  }

  // ===== 填充表单 =====
  function populateForms() {
    document.getElementById('adminName').value = siteData.about.name;
    document.getElementById('adminRole').value = siteData.about.role;
    document.getElementById('adminBio1').value = siteData.about.bio[0] || '';
    document.getElementById('adminBio2').value = siteData.about.bio[1] || '';
    renderStatsEditor();

    document.getElementById('adminEmail').value = siteData.contact.email;
    document.getElementById('adminPhone').value = siteData.contact.phone;
    document.getElementById('adminLocation').value = siteData.contact.location;

    document.getElementById('adminHeroSubtitle').value = siteData.hero.subtitle;
    document.getElementById('adminHeroTitle').value = siteData.hero.title.replace(/<br\s*\/?>/gi, '\n');
    document.getElementById('adminHeroDesc').value = siteData.hero.desc;
    document.getElementById('adminHeroBg').value = siteData.hero.bgImage;
    if (siteData.hero.bgImage) {
      document.getElementById('adminHeroBgPreview').innerHTML = '<img src="' + siteData.hero.bgImage + '" alt="预览">';
    }
  }

  // ===== 统计项编辑器 =====
  function renderStatsEditor() {
    var container = document.getElementById('adminStats');
    container.innerHTML = siteData.about.stats.map(function (s, i) {
      return '<div class="admin-stat-row">' +
        '<input type="text" class="admin-input admin-stat-num" value="' + s.number + '" placeholder="数值" data-idx="' + i + '">' +
        '<input type="text" class="admin-input admin-stat-label" value="' + s.label + '" placeholder="标签" data-idx="' + i + '">' +
        '<button class="admin-btn admin-btn-icon admin-btn-danger-text" data-remove-stat="' + i + '" title="删除">\u00D7</button>' +
        '</div>';
    }).join('');

    container.querySelectorAll('[data-remove-stat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.removeStat);
        siteData.about.stats.splice(idx, 1);
        renderStatsEditor();
      });
    });
  }

  function addStatField() {
    siteData.about.stats.push({ number: '', label: '' });
    renderStatsEditor();
  }

  // ===== 作品管理 =====
  function renderGalleryList() {
    var list = document.getElementById('adminGalleryList');
    var count = document.getElementById('galleryCount');
    count.textContent = siteData.gallery.length;

    var categoryMap = { landscape: '风光', street: '街拍', portrait: '人像', nature: '自然' };
    var sizeMap = { tall: '竖版', wide: '横版' };

    list.innerHTML = siteData.gallery.map(function (item) {
      var sizeText = item.size ? ' \u00B7 ' + (sizeMap[item.size] || item.size) : '';
      return '<div class="admin-gallery-item">' +
        '<div class="admin-gallery-thumb" style="background-image:url(\'' + item.image + '\')"></div>' +
        '<div class="admin-gallery-info"><h4>' + item.title + '</h4><p>' + item.desc + ' \u00B7 ' + (categoryMap[item.category] || item.category) + sizeText + '</p></div>' +
        '<div class="admin-gallery-actions"><button class="admin-btn admin-btn-outline admin-btn-sm" data-action="edit" data-id="' + item.id + '">编辑</button><button class="admin-btn admin-btn-outline admin-btn-danger-text admin-btn-sm" data-action="delete" data-id="' + item.id + '">删除</button></div>' +
        '</div>';
    }).join('');
  }

  function showGalleryEditor(editId) {
    var item = editId ? siteData.gallery.find(function (g) { return g.id === editId; }) : null;
    var isNew = !item;
    if (isNew) {
      item = { id: Date.now(), title: '', desc: '', category: 'landscape', image: '', size: '' };
    }

    var editor = document.getElementById('galleryEditorModal');
    if (!editor) {
      editor = document.createElement('div');
      editor.id = 'galleryEditorModal';
      editor.className = 'admin-modal';
      document.body.appendChild(editor);
    }

    editor.innerHTML =
      '<div class="admin-modal-box admin-modal-box-lg">' +
        '<h3>' + (isNew ? '添加作品' : '编辑作品') + '</h3>' +
        '<div class="admin-form-group"><label>作品标题</label><input type="text" id="geTitle" class="admin-input" value="' + escapeAttr(item.title) + '"></div>' +
        '<div class="admin-form-group"><label>作品描述</label><input type="text" id="geDesc" class="admin-input" value="' + escapeAttr(item.desc) + '"></div>' +
        '<div class="admin-form-group"><label>分类</label><select id="geCategory" class="admin-select">' +
          '<option value="landscape"' + (item.category === 'landscape' ? ' selected' : '') + '>风光</option>' +
          '<option value="street"' + (item.category === 'street' ? ' selected' : '') + '>街拍</option>' +
          '<option value="portrait"' + (item.category === 'portrait' ? ' selected' : '') + '>人像</option>' +
          '<option value="nature"' + (item.category === 'nature' ? ' selected' : '') + '>自然</option>' +
        '</select></div>' +
        '<div class="admin-form-group"><label>尺寸</label><select id="geSize" class="admin-select">' +
          '<option value=""' + (!item.size ? ' selected' : '') + '>标准</option>' +
          '<option value="tall"' + (item.size === 'tall' ? ' selected' : '') + '>竖版（占两行）</option>' +
          '<option value="wide"' + (item.size === 'wide' ? ' selected' : '') + '>横版（占两列）</option>' +
        '</select></div>' +
        '<div class="admin-form-group"><label>图片 URL</label><input type="text" id="geImage" class="admin-input" value="' + escapeAttr(item.image) + '" placeholder="https://..."><div id="geImagePreview" class="admin-img-preview">' + (item.image ? '<img src="' + item.image + '" alt="预览">' : '') + '</div></div>' +
        '<div class="admin-form-group"><label>或上传本地图片</label><input type="file" id="geFileInput" accept="image/*" class="admin-file-input"><label for="geFileInput" class="admin-file-label">选择图片</label><p class="admin-hint">上传的图片会转为 base64 存储，建议不超过 500KB</p></div>' +
        '<div class="admin-modal-actions"><button class="admin-btn admin-btn-primary" id="geSave">保存</button><button class="admin-btn admin-btn-ghost" id="geCancel">取消</button></div>' +
      '</div>';

    editor.classList.add('active');

    // Preview
    document.getElementById('geImage').addEventListener('input', function (e) {
      var preview = document.getElementById('geImagePreview');
      if (e.target.value) {
        preview.innerHTML = '<img src="' + e.target.value + '" alt="预览" onerror="this.parentElement.innerHTML=\'<p class=admin-preview-error>图片加载失败</p>\'">';
      } else {
        preview.innerHTML = '';
      }
    });

    // File upload
    document.getElementById('geFileInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        alert('图片过大，建议不超过 500KB。请压缩后重试或使用 URL 方式。');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        document.getElementById('geImage').value = ev.target.result;
        document.getElementById('geImagePreview').innerHTML = '<img src="' + ev.target.result + '" alt="预览">';
      };
      reader.readAsDataURL(file);
    });

    // Save
    document.getElementById('geSave').addEventListener('click', function () {
      item.title = document.getElementById('geTitle').value.trim();
      item.desc = document.getElementById('geDesc').value.trim();
      item.category = document.getElementById('geCategory').value;
      item.size = document.getElementById('geSize').value;
      item.image = document.getElementById('geImage').value.trim();

      if (!item.title || !item.image) {
        alert('请填写作品标题和图片');
        return;
      }

      if (isNew) siteData.gallery.push(item);
      closeGalleryEditor();
      renderGalleryList();
    });

    document.getElementById('geCancel').addEventListener('click', closeGalleryEditor);
    editor.addEventListener('click', function (e) {
      if (e.target === editor) closeGalleryEditor();
    });
  }

  function closeGalleryEditor() {
    var editor = document.getElementById('galleryEditorModal');
    if (editor) editor.classList.remove('active');
  }

  function deleteGalleryItem(id) {
    if (!confirm('确定要删除这个作品吗？')) return;
    siteData.gallery = siteData.gallery.filter(function (g) { return g.id !== id; });
    renderGalleryList();
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ===== 图片上传处理 =====
  function handleImageUpload(e, type) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      if (type === 'photo') {
        siteData.about.photo = ev.target.result;
      } else if (type === 'qr') {
        siteData.contact.wechatQR = ev.target.result;
      }
      updateMediaPreviews();
    };
    reader.readAsDataURL(file);
  }

  function updateMediaPreviews() {
    var photoPreview = document.getElementById('adminPhotoPreview');
    var qrPreview = document.getElementById('adminQRPreview');

    if (photoPreview) {
      photoPreview.innerHTML = siteData.about.photo
        ? '<img src="' + siteData.about.photo + '" alt="个人照片">'
        : '<p class="admin-no-preview">暂无照片</p>';
    }

    if (qrPreview) {
      qrPreview.innerHTML = siteData.contact.wechatQR
        ? '<img src="' + siteData.contact.wechatQR + '" alt="微信二维码">'
        : '<p class="admin-no-preview">暂无二维码</p>';
    }
  }

  // ===== 保存所有更改 =====
  async function saveAll() {
    // Basic
    siteData.about.name = document.getElementById('adminName').value.trim();
    siteData.about.role = document.getElementById('adminRole').value.trim();
    siteData.about.bio[0] = document.getElementById('adminBio1').value.trim();
    siteData.about.bio[1] = document.getElementById('adminBio2').value.trim();

    // Stats
    var statNums = document.querySelectorAll('.admin-stat-num');
    var statLabels = document.querySelectorAll('.admin-stat-label');
    siteData.about.stats = [];
    statNums.forEach(function (input, i) {
      if (statLabels[i]) {
        siteData.about.stats.push({
          number: input.value.trim(),
          label: statLabels[i].value.trim()
        });
      }
    });

    // Contact
    siteData.contact.email = document.getElementById('adminEmail').value.trim();
    siteData.contact.phone = document.getElementById('adminPhone').value.trim();
    siteData.contact.location = document.getElementById('adminLocation').value.trim();

    // Hero
    siteData.hero.subtitle = document.getElementById('adminHeroSubtitle').value.trim();
    siteData.hero.title = document.getElementById('adminHeroTitle').value.trim().replace(/\n/g, '<br>');
    siteData.hero.desc = document.getElementById('adminHeroDesc').value.trim();
    siteData.hero.bgImage = document.getElementById('adminHeroBg').value.trim();

    var ok = await saveData();
    if (ok) {
      applyData();
      showToast('\u2705 保存成功！页面已更新。');
    } else {
      showToast('\u274C 保存失败，请尝试清除浏览器缓存后重试。');
    }
  }

  // ===== 密码修改 =====
  async function changePassword() {
    var newPwd = document.getElementById('adminNewPwd').value;
    var confirmPwd = document.getElementById('adminConfirmPwd').value;

    if (!newPwd) { showToast('请输入新密码'); return; }
    if (newPwd.length < 6) { showToast('密码长度至少 6 位'); return; }
    if (newPwd !== confirmPwd) { showToast('两次输入的密码不一致'); return; }

    var hash = await hashPassword(newPwd);
    localStorage.setItem(PWD_KEY, hash);
    document.getElementById('adminNewPwd').value = '';
    document.getElementById('adminConfirmPwd').value = '';
    showToast('\u2705 密码修改成功');
  }

  // ===== 导出/导入 =====
  function exportData() {
    var blob = new Blob([JSON.stringify(siteData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('\uD83D\uDCE5 数据已导出');
  }

  function importData(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data.hero || !data.about || !data.contact || !data.gallery) {
          showToast('\u274C 数据格式不正确');
          return;
        }
        siteData = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), data);
        await saveData();
        applyData();
        populateForms();
        showToast('\u2705 数据导入成功');
      } catch (err) {
        showToast('\u274C 导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ===== 恢复默认 =====
  async function resetData() {
    if (!confirm('确定要恢复所有默认内容吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：这将清除所有自定义内容！')) return;

    siteData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    await saveData();
    applyData();
    populateForms();
    showToast('\u2705 已恢复默认内容');
  }

  // ===== Toast =====
  function showToast(msg) {
    var toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.className = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(function () { toast.classList.remove('active'); }, 3000);
  }

  // ===== 启动 =====
  document.addEventListener('DOMContentLoaded', init);
})();
