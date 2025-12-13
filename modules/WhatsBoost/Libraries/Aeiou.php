<?php

namespace WhatsBoost\Libraries;

require_once __DIR__ . '/../ThirdParty/node.php';
require_once __DIR__ . '/../vendor/autoload.php';
use WpOrg\Requests\Requests as WhatsBoost_Requests;

class Aeiou
{
    // Bearer, no need for OAUTH token, change this to your bearer string
    // https://build.envato.com/api/#token
    public static function getPurchaseData($code)
    {
        $givemecode = WhatsBoost_Requests::get(WB_GIVE_ME_CODE)->body;
        $bearer = \Config\Services::session()->has('bearer') ? \Config\Services::session()->get('bearer') : $givemecode;
        $headers = ['Content-length' => 0, 'Content-type' => 'application/json; charset=utf-8', 'Authorization' => 'bearer ' . $bearer];
        $verify_url = 'https://api.envato.com/v3/market/author/sale/';
        $options = ['verify' => false, 'headers' => $headers, 'useragent' => 'License verification and Helpdesk for corbitaltech'];
        $response = WhatsBoost_Requests::get($verify_url . '?code=' . $code, $headers, $options);

        if(!$response->success){
            return false;
        }
        $body = json_decode($response->body, true);
        $base_arr = array_intersect_key($body, array_flip(['amount', 'sold_at', 'license', 'support_amount', 'supported_until', 'buyer', 'purchase_count']));
        $item_arr = ['item' => array_intersect_key($body['item'], array_flip(['id', 'name', 'number_of_sales', 'author_username', 'rating', 'rating_count', 'published_at']))];
        $return_arr = array_merge($base_arr, $item_arr);

        if (isset($return_arr['item']) && !empty($return_arr['item'])) {
            $return_arr['item'] = (object) $return_arr['item'];
        }

        return !empty($return_arr) ? (object)$return_arr : false;
    }

    public static function verifyPurchase($code)
    {
        $verify_obj = self::getPurchaseData($code);

        return ((false === $verify_obj) || !\is_object($verify_obj) || isset($verify_obj->error) || !isset($verify_obj->sold_at) || ('' == $verify_obj->supported_until)) ? $verify_obj : null;
    }

    public function validatePurchase($plugin_name)
    {
        $verified = false;
        $Settings_model = model("App\Models\Settings_model");
        $plugins = $Settings_model->get_setting('plugins');
        $plugins = @unserialize($plugins);
        $verification_id = $Settings_model->get_setting($plugin_name . '_verification_id');

        if (!empty($verification_id)) {
            $verification_id = base64_decode($verification_id);
        }

        $id_data = explode('|', $verification_id ?? '');
        $token = $Settings_model->get_setting($plugin_name . '_product_token');

        if (4 == \count($id_data)) {
            $verified = !empty($token);

            $data = json_decode(base64_decode($token));

            if (!empty($data)) {
                $verified = basename(get_plugin_meta_data($plugin_name)['plugin_url']) == $data->item_id && $data->item_id == $id_data[0] && $data->buyer == $id_data[2] && $data->purchase_code == $id_data[3];
            }

            if (!empty($Settings_model->get_setting($plugin_name . '_verification_signature'))) {
                $verified = hash_equals(hash_hmac('sha512', $token, $id_data[3]), $Settings_model->get_setting($plugin_name . '_verification_signature'));
            }

            $seconds = $data->check_interval ?? 0;
            $last_verification = (int) $Settings_model->get_setting($plugin_name . '_last_verification');
            if (!empty($seconds) && time() > ($last_verification + $seconds)) {
                $verified = false;
                try {
                    $headers = ['Accept' => 'application/json', 'Authorization' => $token];
                    $request = WhatsBoost_Requests::post(WB_VAL_PROD_POINT, $headers, json_encode(['verification_id' => $verification_id, 'item_id' => basename(get_plugin_meta_data('WhatsBoost')['plugin_url']), 'activated_domain' => base_url(), 'version' => get_plugin_meta_data('WhatsBoost')['version']]));
                    $result = json_decode($request->body);
                    $verified = (200 == $request->status_code && !empty($result->valid));
                } catch (Exception $e) {
                    $verified = true;
                }

                $Settings_model->save_setting($plugin_name . '_last_verification', time());
            }

            if (empty($token) || !$verified) {
                $last_verification = (int) $Settings_model->get_setting($plugin_name . '_last_verification');
                $heart = json_decode(base64_decode($Settings_model->get_setting($plugin_name . '_heartbeat')));
                $verified = (!empty($heart) && ($last_verification + (168 * (3000 + 600))) > time()) ?? false;
            }

            if (!$verified) {
                helper('filesystem');
                write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data($plugin_name)['plugin_url']) . '.lic', '');
                $plugins = $Settings_model->get_setting('plugins');
                $plugins = @unserialize($plugins);
                if (isset($plugins[$plugin_name])) {
                    unset($plugins[$plugin_name]);
                }
                save_plugins_config($plugins);
            }

            return $verified;
        }
    }
}
