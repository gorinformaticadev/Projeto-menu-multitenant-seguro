<?php

namespace WhatsBoost\Libraries;

require_once __DIR__ . '/../ThirdParty/node.php';
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/Aeiou.php';
use WpOrg\Requests\Requests as WhatsBoost_Requests;

class Apiinit
{
    public static function the_da_vinci_code($plugin_name)
    {
        $Settings_model = model("App\Models\Settings_model");
        $verification_id = $Settings_model->get_setting($plugin_name . '_verification_id');

        $verification_id = !empty($verification_id) ? base64_decode($verification_id) : '';
        $token = $Settings_model->get_setting($plugin_name . '_product_token');

        $id_data = explode('|', $verification_id);
        $verified = !((empty($verification_id)) || (4 != \count($id_data)));

        if (4 === \count($id_data) && null !== $token) {
            $verified = !empty($token);
            try {

                $data = json_decode(base64_decode($token));

                if (!empty($data)) {
                    $verified = basename(get_plugin_meta_data($plugin_name)['plugin_url']) == $data->item_id && $data->item_id == $id_data[0] && $data->buyer == $id_data[2] && $data->purchase_code == $id_data[3];
                }

                if (!empty($Settings_model->get_setting($plugin_name . '_verification_signature'))) {
                    $verified = hash_equals(hash_hmac('sha512', $token, $id_data[3]), $Settings_model->get_setting($plugin_name . '_verification_signature'));
                }

            } catch (Exception $e) {
                $verified = false;
            }

            $last_verification = (int) $Settings_model->get_setting($plugin_name . '_last_verification');
            $seconds = $data->check_interval ?? 0;

            if (!empty($seconds) && time() > ($last_verification + $seconds)) {
                $verified = false;
                try {
                    $request = WhatsBoost_Requests::post(WB_VAL_PROD_POINT, ['Accept' => 'application/json', 'Authorization' => $token], json_encode(['verification_id' => $verification_id, 'item_id' => basename(get_plugin_meta_data($plugin_name)['plugin_url']), 'activated_domain' => base_url(), 'version' => get_plugin_meta_data('WhatsBoost')['version']]));
                    $status = $request->status_code;
                    if ((500 <= $status && $status <= 599) || 404 == $status) {
                        $Settings_model->save_setting($plugin_name . '_heartbeat', base64_encode(json_encode(['status' => $status, 'id' => $token, 'end_point' => WB_VAL_PROD_POINT])));
                        $verified = false;
                    } else {
                        $result = json_decode($request->body);
                        $verified = !empty($result->valid);
                        if ($verified) {
                            $dbprefix = get_db_prefix();
                            $db = db_connect('default');
                            $builder = $db->table($dbprefix . 'settings');
                            $builder->where('setting_name', $plugin_name . '_heartbeat')->delete();
                        }
                    }
                } catch (Exception $e) {
                    $verified = false;
                }
                $Settings_model->save_setting($plugin_name . '_last_verification', time());
            }
        }

        if (!$verified) {
            $plugins = $Settings_model->get_setting('plugins');
            $plugins = @unserialize($plugins);
            if (isset($plugins[$plugin_name])) {
                unset($plugins[$plugin_name]);
            }

            if (!empty($plugins)) {
                save_plugins_config($plugins);
            }
            helper('filesystem');
            write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', '');
            $Settings_model->save_setting('plugins', serialize($plugins));
        }

        return $verified;
    }

    public static function ease_of_mind($plugin_name)
    {
        if (!\function_exists($plugin_name . '_actLib')) {
            helper('filesystem');
            write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', '');
            $Settings_model = model("App\Models\Settings_model");
            $plugins = $Settings_model->get_setting('plugins');
            $plugins = @unserialize($plugins);
            $plugins[$plugin_name] = 'deactivated';
            if (!empty($plugins)) {
                save_plugins_config($plugins);
            }

            $Settings_model->save_setting('plugins', serialize($plugins));
        }
    }

    public static function getUserIP()
    {
        $ipaddress = '';
        if (isset($_SERVER['HTTP_CLIENT_IP'])) {
            $ipaddress = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ipaddress = $_SERVER['HTTP_X_FORWARDED_FOR'];
        } elseif (isset($_SERVER['HTTP_X_FORWARDED'])) {
            $ipaddress = $_SERVER['HTTP_X_FORWARDED'];
        } elseif (isset($_SERVER['HTTP_FORWARDED_FOR'])) {
            $ipaddress = $_SERVER['HTTP_FORWARDED_FOR'];
        } elseif (isset($_SERVER['HTTP_FORWARDED'])) {
            $ipaddress = $_SERVER['HTTP_FORWARDED'];
        } elseif (isset($_SERVER['REMOTE_ADDR'])) {
            $ipaddress = $_SERVER['REMOTE_ADDR'];
        } else {
            $ipaddress = 'UNKNOWN';
        }

        return $ipaddress;
    }

    public static function pre_validate($plugin_name, $code = '')
    {
        if (empty($code)) {
            return ['status' => false, 'message' => 'Purchase key is required'];
        }

        $Settings_model = model("App\Models\Settings_model");
        $plugins = $Settings_model->get_setting('plugins');
        $all_activated = @unserialize($plugins);

        if (!($all_activated && \is_array($all_activated))) {
            $all_activated = [];
        }

        foreach ($all_activated as $active_plugin => $value) {
            $verification_id = $Settings_model->get_setting($active_plugin . '_verification_id');
            if (!empty($verification_id)) {
                $verification_id = (base64_decode($verification_id, true) == false) ? $verification_id : base64_decode($verification_id);
                $id_data = explode('|', $verification_id);
                if ($id_data[3] == $code) {
                    return ['status' => false, 'message' => 'This Purchase code is Already being used in other module'];
                }
            }
        }

        $envato_res = \WhatsBoost\Libraries\Aeiou::getPurchaseData($code);

        if (empty($envato_res)) {
            return ['status' => false, 'message' => 'Something went wrong'];
        }
        if (!empty($envato_res->error)) {
            return ['status' => false, 'message' => $envato_res->description];
        }
        if (empty($envato_res->sold_at)) {
            return ['status' => false, 'message' => 'Sold time for this code is not found'];
        }
        if ((false === $envato_res) || !\is_object($envato_res) || isset($envato_res->error) || !isset($envato_res->sold_at)) {
            return ['status' => false, 'message' => 'Something went wrong'];
        }

        if (basename(get_plugin_meta_data($plugin_name)['plugin_url']) != $envato_res->item->id) {
            return ['status' => false, 'message' => 'Purchase key is not valid'];
        }

        $request = \Config\Services::request();
        $agent_data = $request->getUserAgent();
        
        $data['user_agent'] = $agent_data->getBrowser() . ' ' . $agent_data->getVersion();
        $data['activated_domain'] = base_url();
        $data['requested_at'] = date('Y-m-d H:i:s');
        $data['ip'] = self::getUserIP();
        $data['os'] = $agent_data->getPlatform();
        $data['purchase_code'] = $code;
        $data['envato_res'] = $envato_res;
        $data['installed_version'] = get_plugin_meta_data($plugin_name)['version'];
        $data = json_encode($data);
        helper('filesystem');
        try {
            $headers = ['Accept' => 'application/json'];
            $request = WhatsBoost_Requests::post(WB_REG_PROD_POINT, $headers, $data);
            if ($request->status_code >= 500 || 404 == $request->status_code) {
                $Settings_model->save_setting($plugin_name . '_verification_id', '');
                $Settings_model->save_setting($plugin_name . '_last_verification', time());
                $Settings_model->save_setting($plugin_name . '_heartbeat', base64_encode(json_encode(['status' => $request->status_code, 'id' => $code, 'end_point' => WB_REG_PROD_POINT])));
                write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', '');
                return ['status' => true];
            }

            $response = json_decode($request->body);
            if (200 != $response->status) {
                return ['status' => false, 'message' => $response->message];
            }

            $return = $response->data ?? [];
            if (!empty($return)) {
                list($token, $providedSignature) = explode('.', $return->token);
                $Settings_model->save_setting($plugin_name . '_verification_id', base64_encode($return->verification_id));
                $Settings_model->save_setting($plugin_name . '_last_verification', time());
                $Settings_model->save_setting($plugin_name . '_verification_signature', $providedSignature);
                $Settings_model->save_setting($plugin_name . '_product_token', $token);

                $dbprefix = get_db_prefix();
                $db = db_connect('default');

                $sql_query = 'DELETE FROM `' . $dbprefix . 'settings` WHERE `' . $dbprefix . "settings`.`setting_name`='" . $plugin_name . "_heartbeat';";
                $db->query($sql_query);
                $botOptions = self::get_whatsboost_details();
                $content = (!empty($botOptions['bot_heading']) && !empty($botOptions['bot_actions'])) ? hash_hmac('sha512', $botOptions['bot_heading'], $botOptions['bot_actions']) : '';
                write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', $content);
                return ['status' => true];
            }
        } catch (Exception $e) {
            $Settings_model->save_setting($plugin_name . '_verification_id', '');
            $Settings_model->save_setting($plugin_name . '_last_verification', time());
            $Settings_model->save_setting($plugin_name . '_heartbeat', base64_encode(json_encode(['status' => $request->status_code, 'id' => $code, 'end_point' => WB_REG_PROD_POINT])));
            write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', '');
            return ['status' => true];
        }

        return ['status' => false, 'message' => 'Something went wrong'];
    }

    public static function get_whatsboost_details()
    {
        $settingsModel = model("App\Models\Settings_model");
        $options = [
            'bot_heading' => $settingsModel->get_setting('WhatsBoost_product_token'),
            'bot_actions' => $settingsModel->get_setting('WhatsBoost_verification_id')
        ];
        foreach ($options as $key => $value) {
            $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('AES-256-CBC'));
            $encrypted_data = openssl_encrypt($value, 'AES-256-CBC', basename(get_plugin_meta_data('WhatsBoost')['plugin_url']), 0, $iv);
            $encoded_data = base64_encode($encrypted_data . '::' . $iv);
            list($encrypted_data, $iv) = explode('::', base64_decode(base64_encode($encrypted_data . '::' . $iv)), 2);
            $options[$key] = openssl_decrypt($encrypted_data, 'AES-256-CBC', basename(get_plugin_meta_data('WhatsBoost')['plugin_url']), 0, $iv);
        }

        $options['bot_content'] = basename(get_plugin_meta_data('WhatsBoost')['plugin_url']);
        return $options;
    }
}
