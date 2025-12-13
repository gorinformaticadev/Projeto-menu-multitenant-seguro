<?php

namespace WhatsBoost\Config;

use CodeIgniter\Events\Events;

Events::on('pre_system', function () {
	helper(['whatsboost', 'general', 'filesystem']);
});
