/**
 * PÁGINA DE TUTORIAL DO MÓDULO BOAS-VINDAS
 * 
 * Tutorial de introdução ao sistema
 */

// Define a função da página no escopo global
window.BoasVindasTutorialPage = function() {
  console.log('📚 Inicializando página de Tutorial - Boas-Vindas');
  
  return {
    render: function() {
      const container = document.createElement('div');
      container.className = 'container mx-auto py-6 px-4 max-w-6xl';
      
      // Header
      const header = document.createElement('div');
      header.className = 'mb-8';
      header.innerHTML = `
        <h1 class="text-3xl font-bold text-gray-900 mb-2">👋 Boas-Vindas ao Sistema</h1>
        <p class="text-gray-600">Tutorial de introdução e primeiros passos</p>
      `;
      container.appendChild(header);
      
      // Card de Boas-Vindas
      const welcomeCard = document.createElement('div');
      welcomeCard.className = 'bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 mb-8 text-white';
      welcomeCard.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">🎉 Bem-vindo!</h2>
        <p class="text-lg mb-4">
          Este é o seu guia de introdução ao sistema. Aqui você encontrará tudo o que precisa
          para começar a utilizar a plataforma de forma eficiente.
        </p>
        <p class="text-sm opacity-90">
          Navegue pelas seções abaixo para conhecer as funcionalidades principais.
        </p>
      `;
      container.appendChild(welcomeCard);
      
      // Grid de Cards Tutoriais
      const tutorialsGrid = document.createElement('div');
      tutorialsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8';
      
      // Tutorial 1: Dashboard
      const tutorial1 = document.createElement('div');
      tutorial1.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial1.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">📊</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Dashboard</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Visualize métricas, estatísticas e informações importantes do sistema em tempo real.
        </p>
        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial1.onclick = function() {
        alert('Tutorial do Dashboard será implementado em breve!');
      };
      tutorialsGrid.appendChild(tutorial1);
      
      // Tutorial 2: Módulos
      const tutorial2 = document.createElement('div');
      tutorial2.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial2.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">🧩</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Módulos</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Conheça o sistema modular e como ativar/desativar funcionalidades conforme sua necessidade.
        </p>
        <button class="text-sm text-green-600 hover:text-green-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial2.onclick = function() {
        window.location.href = '/configuracoes/sistema/modulos';
      };
      tutorialsGrid.appendChild(tutorial2);
      
      // Tutorial 3: Configurações
      const tutorial3 = document.createElement('div');
      tutorial3.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial3.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">⚙️</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Configurações</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Personalize o sistema de acordo com suas preferências e necessidades da empresa.
        </p>
        <button class="text-sm text-purple-600 hover:text-purple-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial3.onclick = function() {
        window.location.href = '/configuracoes';
      };
      tutorialsGrid.appendChild(tutorial3);
      
      // Tutorial 4: Usuários
      const tutorial4 = document.createElement('div');
      tutorial4.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial4.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">👥</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Usuários</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Gerencie usuários, permissões e controle de acesso ao sistema.
        </p>
        <button class="text-sm text-yellow-600 hover:text-yellow-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial4.onclick = function() {
        alert('Tutorial de Usuários será implementado em breve!');
      };
      tutorialsGrid.appendChild(tutorial4);
      
      // Tutorial 5: Segurança
      const tutorial5 = document.createElement('div');
      tutorial5.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial5.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">🔒</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Segurança</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Entenda as medidas de segurança implementadas e boas práticas de uso.
        </p>
        <button class="text-sm text-red-600 hover:text-red-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial5.onclick = function() {
        alert('Tutorial de Segurança será implementado em breve!');
      };
      tutorialsGrid.appendChild(tutorial5);
      
      // Tutorial 6: Suporte
      const tutorial6 = document.createElement('div');
      tutorial6.className = 'bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer';
      tutorial6.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <span class="text-2xl">💬</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Suporte</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Precisa de ajuda? Saiba como entrar em contato com nossa equipe de suporte.
        </p>
        <button class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Saiba mais →
        </button>
      `;
      tutorial6.onclick = function() {
        alert('Tutorial de Suporte será implementado em breve!');
      };
      tutorialsGrid.appendChild(tutorial6);
      
      container.appendChild(tutorialsGrid);
      
      // Seção de Primeiros Passos
      const stepsSection = document.createElement('div');
      stepsSection.className = 'bg-white rounded-lg shadow-md p-6 mb-8';
      stepsSection.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-900 mb-4">🚀 Primeiros Passos</h2>
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h3 class="font-medium text-gray-900">Configure seu Perfil</h3>
              <p class="text-sm text-gray-600">Atualize suas informações pessoais e preferências</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h3 class="font-medium text-gray-900">Explore o Dashboard</h3>
              <p class="text-sm text-gray-600">Familiarize-se com as métricas e informações disponíveis</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h3 class="font-medium text-gray-900">Ative os Módulos Necessários</h3>
              <p class="text-sm text-gray-600">Habilite as funcionalidades que você precisa usar</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div>
              <h3 class="font-medium text-gray-900">Comece a Usar</h3>
              <p class="text-sm text-gray-600">Explore as funcionalidades e personalize conforme necessário</p>
            </div>
          </div>
        </div>
      `;
      container.appendChild(stepsSection);
      
      // Botões de Ação
      const actionsSection = document.createElement('div');
      actionsSection.className = 'flex flex-wrap gap-4';
      
      const btnDashboard = document.createElement('button');
      btnDashboard.className = 'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium';
      btnDashboard.textContent = '🏠 Ir para Dashboard';
      btnDashboard.onclick = function() {
        window.location.href = '/dashboard';
      };
      actionsSection.appendChild(btnDashboard);
      
      const btnModules = document.createElement('button');
      btnModules.className = 'px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium';
      btnModules.textContent = '🧩 Ver Módulos';
      btnModules.onclick = function() {
        window.location.href = '/configuracoes/sistema/modulos';
      };
      actionsSection.appendChild(btnModules);
      
      const btnProfile = document.createElement('button');
      btnProfile.className = 'px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium';
      btnProfile.textContent = '👤 Meu Perfil';
      btnProfile.onclick = function() {
        window.location.href = '/perfil';
      };
      actionsSection.appendChild(btnProfile);
      
      container.appendChild(actionsSection);
      
      console.log('✅ Página de Tutorial renderizada com sucesso');
      return container;
    }
  };
};

console.log('📄 Script da página de Tutorial carregado');
