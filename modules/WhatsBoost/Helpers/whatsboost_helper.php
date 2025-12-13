<?php

use CodeIgniter\I18n\Time;
use WhatsBoost\Models\InteractionModel;
use App\Models\Lead_source_model;
use App\Models\Users_model;
use App\Models\Settings_model;
use League\Csv\Reader;
use League\Csv\Statement;

global $db;
$db = db_connect();

global $interactionModel;
global $Lead_source_model;
global $Users_model;

$interactionModel = new InteractionModel();
$Lead_source_model = new Lead_source_model();
$Users_model = new Users_model();

if (!function_exists('wbGetCampaignData')) {
    function wbGetCampaignData($campaign_id = '')
    {
        return $GLOBALS['db']->table(get_db_prefix() . 'wb_campaign_data')->where('campaign_id', $campaign_id)->get()->getResultArray();
    }
}

if (!function_exists('wbGetWhatsappTemplate')) {
    function wbGetWhatsappTemplate($id = '')
    {
        $builder  = $GLOBALS['db']->table(get_db_prefix() . 'wb_templates');
        if (is_numeric($id)) {
            return $builder->where(['id' => $id, 'status' => 'APPROVED'])->orderBy('language', 'asc')->get()->getRow();
        }

        return $builder->where('status', 'APPROVED')->orderBy('language', 'asc')->get()->getResult();
    }
}

if (!function_exists('wbGenerateRandomString')) {
    function wbGenerateRandomString($length = 32)
    {
        $characters   = '0123456789abcdefghijklmnopqrstuvwxyz';
        $randomString = '';
        for ($i = 0; $i < $length; ++$i) {
            $randomString .= $characters[rand(0, strlen($characters) - 1)];
        }

        return $randomString;
    }
}

if (!function_exists('wbGetRelType')) {
    function wbGetRelType(): array
    {
        return [
            ''         => '',
            'leads'    => 'Lead',
            'contacts' => 'Customer',
        ];
    }
}

if (!function_exists('wbGetTemplateList')) {
    function wbGetTemplateList(): array
    {
        $builder = $GLOBALS['db']->table(get_db_prefix() . 'wb_templates');
        $query   = $builder->select('CONCAT(template_name," | ",language) as template, id')->where('status', 'APPROVED')->whereIn('header_data_format', ['', 'TEXT', 'IMAGE', 'DOCUMENT'])->orderBy('language')->get();

        $result = [
            '' => '',
        ];

        foreach ($query->getResult() as $value) {
            $result[$value->id] = $value->template;
        }

        return $result;
    }
}

if (!function_exists('wbGetAvailableFields')) {
    function wbGetAvailableFields()
    {
        return [
            [
                'leads' => [
                    ['name' => 'Lead Name', 'key' => '{lead_company_name}'],
                    ['name' => 'Lead Website', 'key' => '{lead_website}'],
                    ['name' => 'Lead Phone Number', 'key' => '{lead_phone}'],
                    ['name' => 'Lead Country', 'key' => '{lead_country}'],
                    ['name' => 'Lead Zip', 'key' => '{lead_zip}'],
                    ['name' => 'Lead City', 'key' => '{lead_city}'],
                    ['name' => 'Lead State', 'key' => '{lead_state}'],
                    ['name' => 'Lead Address', 'key' => '{lead_address}'],
                    ['name' => 'Lead Owner', 'key' => '{lead_owner_name}'],
                    ['name' => 'Lead Status', 'key' => '{lead_lead_status_title}'],
                    ['name' => 'Lead Source', 'key' => '{lead_lead_source_name}'],
                    ['name' => 'Lead Link', 'key' => '{lead_link}'],
                ],
            ],
            [
                'client' => [
                    ['name' => 'Contact Firstname', 'key' => '{contact_first_name}'],
                    ['name' => 'Contact Lastname', 'key' => '{contact_last_name}'],
                    ['name' => 'Contact Phone Number', 'key' => '{contact_phone}'],
                    ['name' => 'Contact Title', 'key' => '{contact_job_title}'],
                    ['name' => 'Contact Email', 'key' => '{contact_email}'],
                    ['name' => 'Contact Skype', 'key' => '{contact_skype}'],
                    ['name' => 'Client Company', 'key' => '{contact_client_company}'],
                    ['name' => 'Client Phone Number', 'key' => '{contact_client_phonenumber}'],
                    ['name' => 'Client Country', 'key' => '{contact_client_country}'],
                    ['name' => 'Client City', 'key' => '{contact_client_city}'],
                    ['name' => 'Client Zip', 'key' => '{contact_client_zip}'],
                    ['name' => 'Client State', 'key' => '{contact_client_state}'],
                    ['name' => 'Client Address', 'key' => '{contact_client_address}'],
                    ['name' => 'Client Vat Number', 'key' => '{contact_client_vat_number}'],
                    ['name' => 'Client ID', 'key' => '{contact_client_id}'],
                    ['name' => 'Password', 'key' => '{contact_password}'],
                ],
            ],
            [
                'other' => [
                    ['name' => 'Logo URL', 'key' => '{logo_url}'],
                    ['name' => 'Main Domain', 'key' => '{main_domain}'],
                ],
            ],
        ];
    }
}

if (!function_exists('wbGetReplyType')) {
    function wbGetReplyType($id = '')
    {
        $reply_types = [
            '1' => app_lang('on_exact_match'),
            '2' => app_lang('when_message_contains'),
            '3' => app_lang('when_client_send_the_first_message'),
            '4' => app_lang('default_message_on_no_match'),
        ];

        if (!empty($id)) {
            return $reply_types[$id];
        }

        return $reply_types;
    }
}

if (!function_exists('wbGetAllowedExtension')) {
    function wbGetAllowedExtension()
    {
        return [
            'image' => [
                'extension' => '.jpeg, .png',
                'size'      => 5,
            ],
            'video' => [
                'extension' => '.mp4, .3gp',
                'size'      => 16,
            ],
            'audio' => [
                'extension' => '.aac, .amr, .mp3, .m4a, .ogg',
                'size'      => 16,
            ],
            'document' => [
                'extension' => '.pdf, .doc, .docx, .txt, .xls, .xlsx, .ppt, .pptx',
                'size'      => 100,
            ],
        ];
    }
}

if (!function_exists('wbAddPrefixAllKey')) {
    function wbAddPrefixAllKey($data, $prefix)
    {
        return array_combine(
            array_map(function ($key) use ($prefix) {
                return '{' . $prefix . '_' . $key . '}';
            }, array_keys($data)),
            $data
        );
    }
}

if (!function_exists('wbParseText')) {
    function wbParseText($rel_data, $type, $data, $return_type = 'text')
    {
        $rel_type                            = $data['rel_type'];

        if ($rel_type == 'leads') {
            $rel_data['lead_source_name'] = $GLOBALS['Lead_source_model']->get_details(['id' => $rel_data['lead_source_id']])->getRow()->title;
            $rel_data['link'] = site_url('leads/view/' . $rel_data['id']);
        } else if ($rel_type == 'contacts') {
            $rel_data['client_company'] = $rel_data['company_name'];
            $rel_data['client_phonenumber'] = $rel_data['phone'];
            $rel_data['client_country'] = $rel_data['country'];
            $rel_data['client_city'] = $rel_data['city'];
            $rel_data['client_zip'] = $rel_data['zip'];
            $rel_data['client_state'] = $rel_data['state'];
            $rel_data['client_address'] = $rel_data['address'];
            $rel_data['client_vat_number'] = $rel_data['vat_number'];
            $client_contact_info = $GLOBALS['Users_model']->get_details(['client_id' => $rel_data['id']])->getRowArray();
            if (!empty($client_contact_info)) {
                $client_contact_info['phonenumber'] = $client_contact_info['phone'] ?? '';
                unset($client_contact_info['id']);
                unset($client_contact_info['phone']);
                $rel_data['company'] = $rel_data['company_name'];
                $rel_data = array_merge($rel_data, $client_contact_info);
            }
        }

        $other_merge_fields                  = [];
        $other_merge_fields['{logo_url}']    = get_logo_url();
        $other_merge_fields['{main_domain}'] = site_url();

        $rel_type           = ('contacts' == $rel_type) ? 'contact' : 'lead';
        $merge_fields       = wbAddPrefixAllKey($rel_data, $rel_type);
        $merge_fields       = array_merge($other_merge_fields, $merge_fields);
        $parse_data         = [];

        for ($i = 1; $i <= $data["{$type}_params_count"]; ++$i) {
            if (wbJsJson($data["{$type}_params"] ?? '[]')) {
                $parsed_text = json_decode($data["{$type}_params"] ?? '[]', true);
                $parsed_text = array_map(static function ($body) use ($merge_fields) {
                    $body['value'] = preg_replace('/@{(.*?)}/', '{$1}', $body['value']);
                    foreach ($merge_fields as $key => $val) {
                        $body['value'] =
                            false !== stripos($body['value'], $key)
                            ? str_replace($key, !empty($val) ? $val : ' ', $body['value'])
                            : str_replace($key, '', $body['value']);
                    }

                    return preg_replace('/\s+/', ' ', trim($body['value']));
                }, $parsed_text);
            } else {
                $parsed_text[1] = preg_replace('/\s+/', ' ', trim($data["{$type}_params"]));
            }

            if ('text' == $return_type && !empty($data["{$type}_message"])) {
                $data["{$type}_message"] = str_replace("{{{$i}}}", !empty($parsed_text[$i]) ? $parsed_text[$i] : ' ', $data["{$type}_message"]);
            }
            $parse_data[] = !empty($parsed_text[$i]) ? $parsed_text[$i] : '.';
        }

        return ('text' == $return_type) ? $data["{$type}_message"] : $parse_data;
    }
}

/*
 * Check if a string is a valid JSON
 *
 * @param string $string
 * @return bool
 */
if (!function_exists('wbJsJson')) {
    function wbJsJson($string)
    {
        return ((is_string($string) &&
            (is_object(json_decode($string)) ||
                is_array(json_decode($string))))) ? true : false;
    }
}

/*
 * Parse message text with merge fields
 *
 * @param array $data
 * @return array
 */
if (!function_exists('wbParseMessageText')) {
    function wbParseMessageText($data, $rel_data)
    {
        $rel_type = $data['rel_type'];

        if ($rel_type == 'leads') {
            $rel_data['lead_source_name'] = $GLOBALS['Lead_source_model']->get_details(['id' => $rel_data['lead_source_id']])->getRow()->title;
            $rel_data['link'] = site_url('leads/view/' . $rel_data['id']);
        } else if ($rel_type == 'contacts') {
            $rel_data['client_company'] = $rel_data['company_name'];
            $rel_data['client_phonenumber'] = $rel_data['phone'];
            $rel_data['client_country'] = $rel_data['country'];
            $rel_data['client_city'] = $rel_data['city'];
            $rel_data['client_zip'] = $rel_data['zip'];
            $rel_data['client_state'] = $rel_data['state'];
            $rel_data['client_address'] = $rel_data['address'];
            $rel_data['client_vat_number'] = $rel_data['vat_number'];
            $client_contact_info = $GLOBALS['Users_model']->get_details(['client_id' => $rel_data['id']])->getRowArray();
            if (!empty($client_contact_info)) {
                $client_contact_info['phonenumber'] = $client_contact_info['phone'] ?? '';
                unset($client_contact_info['id']);
                unset($client_contact_info['phone']);
                $rel_data['company'] = $rel_data['company_name'];
                $rel_data = array_merge($rel_data, $client_contact_info);
            }
        }

        $rel_type = ('contacts' == $rel_type) ? 'contact' : 'lead';
        $merge_fields = wbAddPrefixAllKey($rel_data, $rel_type);

        $other_merge_fields                  = [];
        $other_merge_fields['{logo_url}']    = get_logo_url();
        $other_merge_fields['{main_domain}'] = site_url();

        $merge_fields       = array_merge($other_merge_fields, $merge_fields);

        $data['reply_text'] = preg_replace('/@{(.*?)}/', '{$1}', $data['reply_text']);
        foreach ($merge_fields as $key => $val) {
            $data['reply_text'] =
                false !== stripos($data['reply_text'], $key)
                ? str_replace($key, !empty($val) ? $val : ' ', $data['reply_text'])
                : str_replace($key, '', $data['reply_text']);
        }

        return $data;
    }
}

if (!function_exists('can_access_messages_module')) {
    $uri = service('uri');
    // Check if the path of the current URI matches 'whatsboost/chat'
    if ('whatsboost/chat' === $uri->getPath()) {
        // Define the 'can_access_messages_module' function
        // This function will return false, indicating that access to the messages module is not allowed
        function can_access_messages_module()
        {
            return false;
        }
    }
}

if (!function_exists('wb_total_rows')) {
    function wb_total_rows($table, $where = [])
    {
        $builder = $GLOBALS['db']->table($table);
        if (is_array($where)) {
            if (count($where) > 0) {
                $builder->where($where);
            }
        } elseif ('' !== $where) {
            $builder->where($where);
        }

        return $builder->countAllResults();
    }
}

if (!function_exists('wbCampaignStatus')) {
    function wbCampaignStatus($status_id = '')
    {
        $statusid              = ['0', '1', '2'];
        $status['label']       = ['Failed', 'Pending', 'Success'];
        $status['class']       = ['bg-danger', 'bg-warning', 'bg-success'];
        if (in_array($status_id, $statusid)) {
            $index = array_search($status_id, $statusid);
            if (false !== $index && isset($status['label'][$index])) {
                $status['label'] = $status['label'][$index];
            }
            if (false !== $index && isset($status['class'][$index])) {
                $status['class'] = $status['class'][$index];
            }
        } else {
            $status['label'] = app_lang('draft');
            $status['class'] = 'label-default';
        }

        return $status;
    }
}

if (!function_exists('wbUploadFileToTemp')) {
    function wbUploadFileToTemp($upload_to_local = false)
    {
        if (!empty($_FILES) && get_array_value($_FILES, 'file')) {
            $file = get_array_value($_FILES, 'file');
            if (!$file) {
                exit('Invalid file');
            }

            $temp_file = get_array_value($file, 'tmp_name');
            $file_name = get_array_value($file, 'name');
            $file_size = get_array_value($file, 'size');

            if (!is_valid_file_to_upload($file_name)) {
                return false;
            }

            if (defined('PLUGIN_CUSTOM_STORAGE') && !$upload_to_local) {
                try {
                    app_hooks()->do_action('app_hook_upload_file_to_temp', [
                        'temp_file' => $temp_file,
                        'file_name' => $file_name,
                        'file_size' => $file_size,
                    ]);
                } catch (\Exception $ex) {
                    log_message('error', '[ERROR] {exception}', ['exception' => $ex]);
                }
            } else {
                $temp_file_path = get_setting('temp_file_path');
                $target_path    = getcwd() . '/' . $temp_file_path;
                if (!is_dir($target_path)) {
                    if (!mkdir($target_path, 0755, true)) {
                        exit('Failed to create file folders.');
                    }
                }
                $target_file = $target_path . $file_name;
                copy($temp_file, $target_file);
            }
        } elseif (!empty($_FILES) && get_array_value($_FILES, 'document')) {
            $file = get_array_value($_FILES, 'document');
            if (!$file) {
                exit('Invalid document');
            }

            $temp_file = get_array_value($file, 'tmp_name');
            $file_name = get_array_value($file, 'name');
            $file_size = get_array_value($file, 'size');

            if (!is_valid_file_to_upload($file_name)) {
                return false;
            }

            if (defined('PLUGIN_CUSTOM_STORAGE') && !$upload_to_local) {
                try {
                    app_hooks()->do_action('app_hook_upload_file_to_temp', [
                        'temp_file' => $temp_file,
                        'file_name' => $file_name,
                        'file_size' => $file_size,
                    ]);
                } catch (\Exception $ex) {
                    log_message('error', '[ERROR] {exception}', ['exception' => $ex]);
                }
            } else {
                $temp_file_path = get_setting('temp_file_path');
                $target_path    = getcwd() . '/' . $temp_file_path;
                if (!is_dir($target_path)) {
                    if (!mkdir($target_path, 0755, true)) {
                        exit('Failed to create file folders.');
                    }
                }
                $target_file = $target_path . $file_name;
                copy($temp_file, $target_file);
            }
        }
    }
}

if (!function_exists('wbMoveTempFile')) {
    function wbMoveTempFile($file_name, $target_path, $related_to = '', $source_path = null, $static_file_name = '', $file_content = '', $direct_upload = false, $file_size = 0)
    {
        //to make the file name unique we'll add a prefix
        $filename_prefix = $related_to . '_' . uniqid('file') . '-';

        //if not provide any source path we'll find the default path
        if (!$source_path) {
            $source_path = getcwd() . '/' . get_setting('temp_file_path') . $file_name;
        }

        //remove unsupported values from the file name
        $new_filename = $filename_prefix . preg_replace('/\s+/', '-', $file_name);

        $new_filename = str_replace('’', '-', $new_filename);
        $new_filename = str_replace("'", '-', $new_filename);
        $new_filename = str_replace('(', '-', $new_filename);
        $new_filename = str_replace(')', '-', $new_filename);

        //overwrite extisting logic and use static file name
        if ($static_file_name) {
            $new_filename = $static_file_name;
        }

        $files_data = [];

        if (defined('PLUGIN_CUSTOM_STORAGE')) {
            try {
                $files_data = app_hooks()->apply_filters('app_filter_move_temp_file', [
                    'related_to'    => $related_to,
                    'file_name'     => $file_name,
                    'new_filename'  => $new_filename,
                    'file_content'  => $file_content,
                    'source_path'   => $source_path,
                    'target_path'   => $target_path,
                    'direct_upload' => $direct_upload,
                ]);
            } catch (\Exception $ex) {
                log_message('error', '[ERROR] {exception}', ['exception' => $ex]);
                exit();
            }
        } else {
            //check destination directory. if not found try to create a new one
            if (!is_dir($target_path)) {
                if (!mkdir($target_path, 0755, true)) {
                    exit('Failed to create file folders.');
                }
                //create a index.html file inside the folder
                copy(getcwd() . '/' . get_setting('system_file_path') . 'index.html', $target_path . 'index.html');
            }

            if ($file_content) {
                //check if it's the contents of file
                file_put_contents($target_path . $new_filename, $file_content);

                //                $fp = fopen($target_path . $new_filename, "w+");
                //                fwrite($fp, $file_content);
                //                fclose($fp);
            } elseif (starts_with($source_path, 'data')) {
                //check the file type is data or file. then copy to destination and remove temp file
                if ('copy' === get_setting('file_copy_type')) {
                    copy($source_path, $target_path . $new_filename);
                } else {
                    copy_text_based_image($source_path, $target_path . $new_filename);
                }
            } else {
                if (file_exists($source_path)) {
                    copy($source_path, $target_path . $new_filename);
                    unlink($source_path);
                }
            }

            $files_data = ['file_name' => $new_filename];
        }

        if ($files_data && count($files_data)) {
            return $files_data;
        }

        return false;
    }
}

if (!function_exists('wbHandleUploadFile')) {
    function wbHandleUploadFile($id = '', $data = [], $type = '')
    {
        wbUploadFileToTemp();

        $target_path = getcwd() . '/files/whatsboost/' . $type . '/';
        if (isset($_FILES['file']['name']) && !empty(isset($_FILES['file']['name']))) {
            $file_info = wbMoveTempFile($_FILES['file']['name'], $target_path, '');
            if ($file_info) {
                $filePath = getcwd() . '/files/whatsboost/' . $type . '/' . $data['filename'];
                if (!empty($postData['filename']) && file_exists($filePath)) {
                    unlink($filePath);
                }
                $data['filename'] = get_array_value($file_info, 'file_name');
                $data             = clean_data($data);
                if ($type != 'csv') {
                    $table            = ('bot' != $type) ? 'campaigns' : $type;
                    $GLOBALS['db']->table(get_db_prefix() . 'wb_' . $table)->set(['filename' => $data['filename']])->where('id', $id)->update();
                }

                return ['status' => true, 'filename' => $data['filename']];
            }
        } elseif (isset($_FILES['document']['name']) && !empty(isset($_FILES['document']['name']))) {
            $file_info = wbMoveTempFile($_FILES['document']['name'], $target_path, '');
            if ($file_info) {
                $filePath = getcwd() . '/files/whatsboost/' . $type . '/' . $data['filename'];
                if (!empty($postData['filename']) && file_exists($filePath)) {
                    unlink($filePath);
                }
                $data['filename'] = get_array_value($file_info, 'file_name');
                $data             = clean_data($data);
                if ($type != 'csv') {
                    $table            = ('bot' != $type) ? 'campaigns' : $type;
                    $GLOBALS['db']->table(get_db_prefix() . 'wb_' . $table)->set(['filename' => $data['filename']])->where('id', $id)->update();
                }

                return ['status' => true, 'filename' => $data['filename']];
            }
        }

        return ['status' => false];
    }
}

/*
 * Is file image
 * @param  string  $path file path
 * @return boolean
 */
if (!function_exists('wbIsImage')) {
    function wbIsImage($path)
    {
        $possibleBigFiles = [
            'pdf',
            'zip',
            'mp4',
            'ai',
            'psd',
            'ppt',
            'gzip',
            'rar',
            'tar',
            'tgz',
            'mpeg',
            'mpg',
            'flv',
            'mov',
            'wav',
            'avi',
            'dwg',
        ];

        $pathArray = explode('.', $path);
        $ext       = end($pathArray);
        // Causing performance issues if the file is too big
        if (in_array($ext, $possibleBigFiles)) {
            return false;
        }

        $image = @getimagesize($path);
        if ($image) {
            $image_type = $image[2];
            if (in_array($image_type, [
                \IMAGETYPE_GIF,
                \IMAGETYPE_JPEG,
                \IMAGETYPE_PNG,
                \IMAGETYPE_BMP,
            ])) {
                return true;
            }
        }

        return false;
    }
}

/*
 * Check if filename/path is video file
 * @param  string  $path
 * @return boolean
 */
if (!function_exists('wb_is_html5_video')) {
    function wb_is_html5_video($path)
    {
        $ext = wb_get_file_extension($path);
        if (in_array($ext, wb_get_html5_video_extensions())) {
            return true;
        }

        return false;
    }
}

/*
 * Supported html5 video extensions
 * @return array
 */
if (!function_exists('wb_get_html5_video_extensions')) {
    function wb_get_html5_video_extensions()
    {
        return [
            'mp4',
            'm4v',
            'webm',
            'ogv',
            'ogg',
            'flv',
        ];
    }
}

/*
 * Get file extension by filename
 * @param  string $file_name file name
 * @return mixed
 */
if (!function_exists('wb_get_file_extension')) {
    function wb_get_file_extension($file_name)
    {
        return substr(strrchr($file_name, '.'), 1);
    }
}

if (!function_exists('initWhatsboostPermission')) {
    function initWhatsboostPermission($permissions)
    {
        $content = '
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_connect_account') . '</h5>
                <div>
                    ' . form_checkbox('wb_connect', '1', get_array_value($permissions, 'wb_connect') ? true : false, "id='wb_connect' class='form-check-input'") . '
                    <label for="wb_connect">' . app_lang('connect') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_message_bot') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_mb', '1', get_array_value($permissions, 'wb_view_mb') ? true : false, "id='wb_view_mb' class='form-check-input'") . '
                    <label for="wb_view_mb">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_mb', '1', get_array_value($permissions, 'wb_create_mb') ? true : false, "id='wb_create_mb' class='form-check-input'") . '
                    <label for="wb_create_mb">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_mb', '1', get_array_value($permissions, 'wb_edit_mb') ? true : false, "id='wb_edit_mb' class='form-check-input'") . '
                    <label for="wb_edit_mb">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_mb', '1', get_array_value($permissions, 'wb_delete_mb') ? true : false, "id='wb_delete_mb' class='form-check-input'") . '
                    <label for="wb_delete_mb">' . app_lang('delete') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_clone_mb', '1', get_array_value($permissions, 'wb_clone_mb') ? true : false, "id='wb_clone_mb' class='form-check-input'") . '
                    <label for="wb_clone_mb">' . app_lang('clone_bot') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_template_bot') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_tb', '1', get_array_value($permissions, 'wb_view_tb') ? true : false, "id='wb_view_tb' class='form-check-input'") . '
                    <label for="wb_view_tb">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_tb', '1', get_array_value($permissions, 'wb_create_tb') ? true : false, "id='wb_create_tb' class='form-check-input'") . '
                    <label for="wb_create_tb">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_tb', '1', get_array_value($permissions, 'wb_edit_tb') ? true : false, "id='wb_edit_tb' class='form-check-input'") . '
                    <label for="wb_edit_tb">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_tb', '1', get_array_value($permissions, 'wb_delete_tb') ? true : false, "id='wb_delete_tb' class='form-check-input'") . '
                    <label for="wb_delete_tb">' . app_lang('delete') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_clone_tb', '1', get_array_value($permissions, 'wb_clone_tb') ? true : false, "id='wb_clone_tb' class='form-check-input'") . '
                    <label for="wb_clone_tb">' . app_lang('clone_bot') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_template') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_template', '1', get_array_value($permissions, 'wb_view_template') ? true : false, "id='wb_view_template' class='form-check-input'") . '
                    <label for="wb_view_template">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_log_template', '1', get_array_value($permissions, 'wb_log_template') ? true : false, "id='wb_log_template' class='form-check-input'") . '
                    <label for="wb_log_template">' . app_lang('load_template') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_campaigns') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_campaign', '1', get_array_value($permissions, 'wb_view_campaign') ? true : false, "id='wb_view_campaign' class='form-check-input'") . '
                    <label for="wb_view_campaign">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_campaign', '1', get_array_value($permissions, 'wb_create_campaign') ? true : false, "id='wb_create_campaign' class='form-check-input'") . '
                    <label for="wb_create_campaign">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_campaign', '1', get_array_value($permissions, 'wb_edit_campaign') ? true : false, "id='wb_edit_campaign' class='form-check-input'") . '
                    <label for="wb_edit_campaign">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_campaign', '1', get_array_value($permissions, 'wb_delete_campaign') ? true : false, "id='wb_delete_campaign' class='form-check-input'") . '
                    <label for="wb_delete_campaign">' . app_lang('delete') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_show_campaign', '1', get_array_value($permissions, 'wb_show_campaign') ? true : false, "id='wb_show_campaign' class='form-check-input'") . '
                    <label for="wb_show_campaign">' . app_lang('show_campaign') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_chat') . '</h5>
                <div class="wb_view_chat_div">
                    ' . form_checkbox('wb_view_chat', '1', get_array_value($permissions, 'wb_view_chat') ? true : false, "id='wb_view_chat' class='form-check-input'") . '
                    <label for="wb_view_chat">' . app_lang('view') . '</label>
                </div>
                <div class="wb_read_only_chat_div">
                    ' . form_checkbox('wb_read_only_chat', '1', get_array_value($permissions, 'wb_read_only_chat') ? true : false, "id='wb_read_only_chat' class='form-check-input'") . '
                    <label for="wb_read_only_chat">' . app_lang('read_only') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_log_activity') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_log', '1', get_array_value($permissions, 'wb_view_log') ? true : false, "id='wb_view_log' class='form-check-input'") . '
                    <label for="wb_view_log">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_clear_log', '1', get_array_value($permissions, 'wb_clear_log') ? true : false, "id='wb_clear_log' class='form-check-input'") . '
                    <label for="wb_clear_log">' . app_lang('clear_log') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_settings') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_settings', '1', get_array_value($permissions, 'wb_view_settings') ? true : false, "id='wb_view_settings' class='form-check-input'") . '
                    <label for="wb_view_settings">' . app_lang('view') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_ai_prompts') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_own_ai_prompts', '1', get_array_value($permissions, 'wb_view_own_ai_prompts') ? true : false, "id='wb_view_own_ai_prompts' class='form-check-input'") . '
                    <label for="wb_view_own_ai_prompts">' . app_lang('view_own') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_view_ai_prompts', '1', get_array_value($permissions, 'wb_view_ai_prompts') ? true : false, "id='wb_view_ai_prompts' class='form-check-input'") . '
                    <label for="wb_view_ai_prompts">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_ai_prompts', '1', get_array_value($permissions, 'wb_create_ai_prompts') ? true : false, "id='wb_create_ai_prompts' class='form-check-input'") . '
                    <label for="wb_create_ai_prompts">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_ai_prompts', '1', get_array_value($permissions, 'wb_edit_ai_prompts') ? true : false, "id='wb_edit_ai_prompts' class='form-check-input'") . '
                    <label for="wb_edit_ai_prompts">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_ai_prompts', '1', get_array_value($permissions, 'wb_delete_ai_prompts') ? true : false, "id='wb_delete_ai_prompts' class='form-check-input'") . '
                    <label for="wb_delete_ai_prompts">' . app_lang('delete') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('wb_canned_reply') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_own_canned_reply', '1', get_array_value($permissions, 'wb_view_own_canned_reply') ? true : false, "id='wb_view_own_canned_reply' class='form-check-input'") . '
                    <label for="wb_view_own_canned_reply">' . app_lang('view_own') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_view_canned_reply', '1', get_array_value($permissions, 'wb_view_canned_reply') ? true : false, "id='wb_view_canned_reply' class='form-check-input'") . '
                    <label for="wb_view_canned_reply">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_canned_reply', '1', get_array_value($permissions, 'wb_create_canned_reply') ? true : false, "id='wb_create_canned_reply' class='form-check-input'") . '
                    <label for="wb_create_canned_reply">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_canned_reply', '1', get_array_value($permissions, 'wb_edit_canned_reply') ? true : false, "id='wb_edit_canned_reply' class='form-check-input'") . '
                    <label for="wb_edit_canned_reply">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_canned_reply', '1', get_array_value($permissions, 'wb_delete_canned_reply') ? true : false, "id='wb_delete_canned_reply' class='form-check-input'") . '
                    <label for="wb_delete_canned_reply">' . app_lang('delete') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('whatsboost_bot_flow_permission') . '</h5>
                <div>
                    ' . form_checkbox('wb_view_bot_flow', '1', get_array_value($permissions, 'wb_view_bot_flow') ? true : false, "id='wb_view_bot_flow' class='form-check-input'") . '
                    <label for="wb_view_bot_flow">' . app_lang('view') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_create_bot_flow', '1', get_array_value($permissions, 'wb_create_bot_flow') ? true : false, "id='wb_create_bot_flow' class='form-check-input'") . '
                    <label for="wb_create_bot_flow">' . app_lang('create') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_edit_bot_flow', '1', get_array_value($permissions, 'wb_edit_bot_flow') ? true : false, "id='wb_edit_bot_flow' class='form-check-input'") . '
                    <label for="wb_edit_bot_flow">' . app_lang('edit') . '</label>
                </div>
                <div>
                    ' . form_checkbox('wb_delete_bot_flow', '1', get_array_value($permissions, 'wb_delete_bot_flow') ? true : false, "id='wb_delete_bot_flow' class='form-check-input'") . '
                    <label for="wb_delete_bot_flow">' . app_lang('delete') . '</label>
                </div>
            </li>
            <li>
                <span data-feather="key" class="icon-14 ml-20"></span>
                <h5>' . app_lang('whatsboost_send_csv_campaign') . '</h5>
                <div>
                    ' . form_checkbox('wb_send_csv_campaign', '1', get_array_value($permissions, 'wb_send_csv_campaign') ? true : false, "id='wb_send_csv_campaign' class='form-check-input'") . '
                    <label for="wb_send_csv_campaign">' . app_lang('send') . '</label>
                </div>
            </li>
        ';

        return $content;
    }
}

if (!function_exists('check_wb_permission')) {
    function check_wb_permission($user_info, $permission_type)
    {
        if ('staff' == $user_info->user_type) {
            if ($user_info->is_admin || 0 == $user_info->role_id) {
                return true;
            }

            return get_array_value($user_info->permissions, $permission_type);
        }

        return true;
    }
}

if (!function_exists('wb_sum_from_table')) {
    function wb_sum_from_table($table, $attr = [])
    {
        $builder = $GLOBALS['db']->table($table);

        if (isset($attr['where']) && is_array($attr['where'])) {
            foreach ($attr['where'] as $key => $val) {
                if (is_numeric($key)) {
                    $builder->where($val);
                } else {
                    $builder->where($key, $val);
                }
            }
        }

        // Perform SUM operation
        $builder->selectSum($attr['field']);

        // Get the result
        $query  = $builder->get();
        $result = $query->getRow();

        // Return the sum value
        return $result->{$attr['field']};
    }
}

if (!function_exists('wbIsJson')) {
    function wbIsJson($string)
    {
        return ((is_string($string) &&
            (is_object(json_decode($string)) ||
                is_array(json_decode($string))))) ? true : false;
    }
}

/*
 * Get the interaction ID based on data, relation type, ID, name, and phone number
 *
 * @param array $data
 * @param string $relType
 * @param string $id
 * @param string $name
 * @param string $phonenumber
 * @return int
 */
if (!function_exists('wbGetInteractionId')) {
    function wbGetInteractionId($data, $relType, $id, $name, $phonenumber, $fromNumber, $contact_data = [])
    {
        $interaction = $GLOBALS['db']->table(get_db_prefix() . 'wb_interactions')->where(['type' => $relType, 'type_id' => $id, 'wa_no' => $fromNumber])->get()->getRow();

        if (!empty($interaction)) {
            return $interaction->id;
        }

        if (empty($phonenumber)) {
            return false;
        }

        // If data has reply type then it is message bot else it is template bot
        $message = '';
        if (!empty($data['reply_type'])) {
            $message_data = wbParseMessageText($data, $contact_data);
            $message      = $message_data['reply_text'];
        }
        if (!empty($data['bot_type'])) {
            $message = wbParseText($data['rel_type'], 'header', $data) . ' ' . wbParseText($data['rel_type'], 'body', $data) . ' ' . wbParseText($data['rel_type'], 'footer', $data);
        }

        $interactionData = [
            'name'          => $name,
            'receiver_id'   => $phonenumber,
            'last_message'  => $message,
            'last_msg_time' => wbGetCurrentTimestamp(),
            'wa_no'         => get_setting('wb_default_phone_number'),
            'wa_no_id'      => get_setting('wb_phone_number_id'),
            'time_sent'     => wbGetCurrentTimestamp(),
            'type'          => $relType,
            'type_id'       => $id,
        ];

        return $GLOBALS['interactionModel']->insert_interaction($interactionData);
    }
}

/*
 * Decode WhatsApp signs to HTML tags
 *
 * @param string $text
 * @return string
 */
if (!function_exists('wbDecodeWhatsAppSigns')) {
    function wbDecodeWhatsAppSigns($text)
    {
        $patterns = [
            '/\*(.*?)\*/',       // Bold
            '/_(.*?)_/',         // Italic
            '/~(.*?)~/',         // Strikethrough
            '/```(.*?)```/',      // Monospace
        ];
        $replacements = [
            '<strong>$1</strong>',
            '<em>$1</em>',
            '<del>$1</del>',
            '<code>$1</code>',
        ];

        return preg_replace($patterns, $replacements, $text);
    }
}

if (!function_exists('wbGetCurrentTimestamp')) {
    function wbGetCurrentTimestamp()
    {
        return Time::now(get_setting('timezone'));
    }
}

if (!function_exists('wbRemoveDeletedData')) {
    function wbRemoveDeletedData()
    {
        $deleted_leads = $GLOBALS['db']->table(get_db_prefix() . 'clients')->select('id')->where(['deleted' => 1, 'is_lead' => 1])->get()->getResultArray();
        $deleted_leads = array_column($deleted_leads, 'id');
        if (count($deleted_leads) > 0) {
            $GLOBALS['db']->table(get_db_prefix() . 'wb_campaign_data')->where('rel_type', 'leads')->whereIn('rel_id', $deleted_leads)->delete();
        }
        $deleted_clients = $GLOBALS['db']->table(get_db_prefix() . 'clients')->select('id')->where(['deleted' => 1, 'is_lead' => 0])->get()->getResultArray();
        $deleted_clients = array_column($deleted_clients, 'id');
        if (count($deleted_clients) > 0) {
            $GLOBALS['db']->table(get_db_prefix() . 'wb_campaign_data')->where('rel_type', 'contacts')->whereIn('rel_id', $deleted_clients)->delete();
        }
        return;
    }
}

if (!function_exists('prepareNewFileName')) {
    function prepareNewFileName($file_name, $related_to = '')
    {
        $file = explode('-', $file_name);
        $filename_prefix = $related_to . '_' . uniqid('file') . '-';
        $new_file_name = $filename_prefix . preg_replace('/\s+/', '-', $file[1]);
        return $new_file_name;
    }
}

if (!function_exists('wb_openai_models')) {
    function wb_openai_models()
    {
        return [
            'gpt-3.5-turbo' => 'GPT-3.5-turbo',
            'gpt-4' => 'GPT-4',
            'gpt-4-turbo-preview' => 'GPT-4-turbo-preview',
            'gpt-4-0125-preview' => 'GPT-4-0125-preview',

        ];
    }
}

if (!function_exists('wbGetStaffFullName')) {
    function wbGetStaffFullName($id)
    {
        $db = db_connect('default');
        $user_builder = $db->table("users");
        $staffDetails = $user_builder->getWhere(['id' => $id])->getRowArray();

        return (!empty($staffDetails)) ? $staffDetails['first_name'] . ' ' . $staffDetails['last_name'] : false;
    }
}

if (!function_exists('wbGetAllStaff')) {
    function wbGetAllStaff()
    {
        $db = db_connect('default');
        $user_builder = $db->table("users");
        $staffDetails = $user_builder->getWhere(['user_type' => 'staff', 'deleted' => 0])->getResultArray();

        return (!empty($staffDetails)) ? $staffDetails : [];
    }
}

// Comentado: Função de validação de licença removida
// if (!function_exists('getWhatsboostDetails')) {
//     function getWhatsboostDetails()
//     {
//         $settingsModel = new Settings_model();
//         $options = [
//             'bot_heading' => $settingsModel->get_setting('WhatsBoost_product_token'),
//             'bot_actions' => $settingsModel->get_setting('WhatsBoost_verification_id')
//         ];
//         foreach ($options as $key => $value) {
//             $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('AES-256-CBC'));
//             $encrypted_data = openssl_encrypt($value, 'AES-256-CBC', basename(get_plugin_meta_data('WhatsBoost')['plugin_url']), 0, $iv);
//             $encoded_data = base64_encode($encrypted_data . '::' . $iv);
//             list($encrypted_data, $iv) = explode('::', base64_decode(base64_encode($encrypted_data . '::' . $iv)), 2);
//             $options[$key] = openssl_decrypt($encrypted_data, 'AES-256-CBC', basename(get_plugin_meta_data('WhatsBoost')['plugin_url']), 0, $iv);
//         }
//
//         $options['bot_content'] = basename(get_plugin_meta_data('WhatsBoost')['plugin_url']);
//         return $options;
//     }
// }

// Função alternativa sem validação
if (!function_exists('getWhatsboostDetails')) {
    function getWhatsboostDetails()
    {
        // Retorna valores padrão sem validação de licença
        $options = [
            'bot_heading' => '',
            'bot_actions' => '',
            'bot_content' => basename(get_plugin_meta_data('WhatsBoost')['plugin_url'])
        ];
        return $options;
    }
}

if (!function_exists('wbGetStaffProfileImage')) {
    function wbGetStaffProfileImage($id)
    {
        $db = db_connect('default');
        $staffDetails = $db->table("users")
            ->select('image')
            ->where(['user_type' => 'staff', 'id' => $id])
            ->get()
            ->getRowArray();

        if (empty($staffDetails) || empty($staffDetails['image'])) {
            return base_url("assets/images/avatar.jpg");
        }

        $image = @unserialize($staffDetails['image']);

        if ($image === false || empty($image['file_name'])) {
            return base_url("assets/images/avatar.jpg");
        }
        return base_url("files/profile_images/" . $image['file_name']);
    }
}

if (!function_exists('wbCsvToJson')) {
    function wbCsvToJson($csvFilePath, $jsonFilePath)
    {
        $csv = Reader::createFromPath($csvFilePath, 'r');
        $csv->setHeaderOffset(0);
        $records = (new Statement())->process($csv);

        $filteredRecords = [];
        if (!empty($records) && in_array('Phoneno', $records->getHeader())) {
            foreach ($records as $record) {
                $newPhonenumber = wbNormalizePhoneNumber(preg_replace('/\s+/', '', $record['Phoneno']));
                $record['Phoneno'] = $newPhonenumber;
                if (!empty($record['Phoneno']) && preg_match('/^\+?[0-9]+$/', $record['Phoneno'])) {
                    $record = array_filter($record, function ($value) {
                        return !empty($value);
                    });
                    $filteredRecords[] = $record;
                }
            }

            if (!empty($filteredRecords)) {
                $jsonData = json_encode($filteredRecords, JSON_PRETTY_PRINT);
                $upload = file_put_contents($jsonFilePath, $jsonData);
                return [
                    'type' => ($upload) ? 'success' : 'danger',
                    'message' => ($upload) ? app_lang('csv_uploaded_successfully') : app_lang('something_went_wrong'),
                    'fields' => $records->getHeader(),
                    'valid' => count($filteredRecords),
                    'not_valid' => count($records) - count($filteredRecords),
                    'total' => count($records),
                    'json_file_path' => $jsonFilePath,
                ];
            }
        }

        return [
            'type' => 'danger',
            'message' => (empty($records)) ? app_lang('phonenumber_field_is_required') : app_lang('please_upload_valid_csv_file'),
            'fields' => $records->getHeader(),
        ];
    }
}

if (!function_exists('wbNormalizePhoneNumber')) {
    function wbNormalizePhoneNumber($phoneNumber)
    {
        $normalizedNumber = sprintf('%.0f', $phoneNumber);
        $normalizedNumber = preg_replace('/\D/', '', $normalizedNumber);;

        return (is_numeric($normalizedNumber) && strlen($normalizedNumber) >= 10) ? $normalizedNumber : null;
    }
}

if (!function_exists('wbParseCsvText')) {
    function wbParseCsvText($type, $data, $rel_data, $return_type = 'text')
    {
        $merge_fields = array_reduce(array_keys($rel_data), function ($carry, $key) use ($rel_data) {
            $carry['{' . $key . '}'] = $rel_data[$key];
            return $carry;
        }, []);
        $parse_data = [];

        for ($i = 1; $i <= $data["{$type}_params_count"]; ++$i) {
            if (wbIsJson($data["{$type}_params"] ?? '[]')) {
                $parsed_text = json_decode($data["{$type}_params"] ?? '[]', true);
                $parsed_text = array_map(static function ($body) use ($merge_fields) {
                    $body['value'] = preg_replace('/@{(.*?)}/', '{$1}', $body['value']);
                    foreach ($merge_fields as $key => $val) {
                        $body['value'] =
                            false !== stripos($body['value'], $key)
                            ? str_replace($key, !empty($val) ? $val : ' ', $body['value'])
                            : str_replace($key, '', $body['value']);
                    }

                    return preg_replace('/\s+/', ' ', trim($body['value']));
                }, $parsed_text);
            } else {
                $parsed_text[1] = preg_replace('/\s+/', ' ', trim($data["{$type}_params"]));
            }

            if ('text' == $return_type && !empty($data["{$type}_message"])) {
                $data["{$type}_message"] = str_replace("{{{$i}}}", !empty($parsed_text[$i]) ? $parsed_text[$i] : ' ', $data["{$type}_message"]);
            }
            $parse_data[] = !empty($parsed_text[$i]) ? $parsed_text[$i] : ' ';
        }
        return ('text' == $return_type) ? $data["{$type}_message"] : $parse_data;
    }
}
