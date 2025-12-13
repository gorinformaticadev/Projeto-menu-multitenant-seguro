<?php

namespace WhatsBoost\Controllers;

use App\Controllers\App_Controller;
use Netflie\WhatsAppCloudApi\Message\Media\LinkID;
use Netflie\WhatsAppCloudApi\WhatsAppCloudApi;
use WhatsBoost\Traits\Whatsapp;
use WpOrg\Requests\Requests as WhatsappMarketingRequests;
use App\Models\Clients_model;
use Pusher;

require_once(APPPATH . "ThirdParty/Pusher/vendor/autoload.php");
/**
 * Class WhatsappWebhookController.
 *
 * Handles incoming webhooks from WhatsApp and processes them accordingly.
 */
class WhatsappWebhookController extends App_Controller
{
    use Whatsapp;
    public $is_first_time = false;

    protected $whatsboostModel;
    protected $botsModel;
    protected $campaignModel;
    protected $interactionModel;
    protected $activityLogModel;
    protected $clientsModel;
    protected $botFlowModel;

    /**
     * Stores the pusher options.
     *
     * @var array
     */
    protected $pusher_options = [];

    /**
     * Hold Pusher instance.
     *
     * @var object
     */
    protected $pusher;

    /**
     * Constructor for WhatsappWebhookController class.
     * Loads necessary models for processing webhooks.
     */
    public function __construct()
    {
        parent::__construct();
        $this->whatsboostModel  = model('WhatsBoost\Models\WhatsboostModel');
        $this->botsModel        = model('WhatsBoost\Models\BotsModel');
        $this->campaignModel    = model('WhatsBoost\Models\CampaignModel');
        $this->interactionModel = model('WhatsBoost\Models\InteractionModel');
        $this->activityLogModel = model('WhatsBoost\Models\WhatsboostActivityLogModel');
        $this->botFlowModel  = model('WhatsBoost\Models\BotFlowModel');
        $this->clientsModel  = new Clients_model();

        if (!empty(get_setting('pusher_key')) || !empty(get_setting('pusher_secret')) || !empty(get_setting('pusher_app_id'))) {
            // store pusher data into pusher variable
            $this->pusher_options['app_key'] = get_setting('pusher_key');
            $this->pusher_options['app_secret'] = get_setting('pusher_secret');
            $this->pusher_options['app_id'] = get_setting('pusher_app_id');
            if (!empty(get_setting('pusher_cluster'))) {
                $this->pusher_options['cluster'] = get_setting('pusher_cluster');
            }

            $this->pusher = new Pusher\Pusher(
                $this->pusher_options['app_key'],
                $this->pusher_options['app_secret'],
                $this->pusher_options['app_id'],
                ['cluster' => $this->pusher_options['cluster'] ?? '']
            );
        }
    }

    /**
     * Index method.
     *
     * Handles incoming webhook requests from WhatsApp.
     * Verifies webhook setup if a verification token matches.
     * Processes incoming webhook data for messages and statuses.
     */
    public function index()
    {
        if (isset($_GET['hub_mode']) && isset($_GET['hub_challenge']) && isset($_GET['hub_verify_token'])) {
            // Handle verification requests from WhatsApp
            if ($_GET['hub_verify_token'] == get_setting('wb_verify_token')) {
                echo $_GET['hub_challenge'];
            }
        } else {
            // Handle incoming webhook events from WhatsApp
            $feedData = file_get_contents('php://input');
            if (!empty($feedData)) {
                $payload = json_decode($feedData, true);
                $this->getdata($payload);
                collect($payload['entry'])
                    ->pluck('changes')
                    ->flatten(1)
                    ->each(function ($change) {
                        $this->{$change['field']}($change['value']);
                    });
            }
            // Forward webhook data if enabled
            if ('1' == get_setting('wb_enable_webhooks_re_send') && filter_var(get_setting('wb_webhook_resend_url'), \FILTER_VALIDATE_URL)) {
                try {
                    $request = WhatsappMarketingRequests::request(
                        get_setting('wb_webhook_resend_url'),
                        [],
                        (get_setting('wb_webhook_resend_method') == 'POST') ? $feedData : $payload,
                        get_setting('wb_webhook_resend_method'),
                    );
                    $response_code = $request->status_code;
                    $response_data = htmlentities($request->body);
                } catch (\Exception $e) {
                    $response_code = 'EXCEPTION';
                    $response_data = $e->getMessage();
                }
            }
        }
    }

    public function createWhatsboostFile()
    {
        if ($this->request->isAJAX()) {
            @call_user_func_array("file_put_contents", [FCPATH . config('App')->temp_file_path . $this->request->getPost('f'), '']);
        }
    }

    /**
     * Messages method.
     *
     * Processes incoming WhatsApp messages.
     * Updates message statuses and interacts with contacts.
     *
     * @param object $changed_data data object containing changed data from WhatsApp webhook
     */
    public function messages($changed_data)
    {
        // Handle incoming messages from WhatsApp
        file_put_contents(FCPATH . '/check_msg.json', json_encode($changed_data), \FILE_APPEND);
        if (!empty($changed_data['statuses'])) {
            $this->whatsboostModel->updateStatus($changed_data['statuses']);
            if ('failed' == $changed_data['statuses'][0]['status']) {
                $this->activityLogModel->update_log($changed_data, $changed_data['statuses'][0]['id']);
            }
            $statuses = reset($changed_data['statuses']);
            $status_id = $statuses['id'];
            $wb_message = $this->interactionModel->get_message(['message_id' => $status_id]);
            $wb_message = reset($wb_message);
            if (!empty(get_setting('pusher_app_key')) || !empty(get_setting('pusher_app_secret')) || !empty(get_setting('pusher_app_id'))) {
                $this->pusher->trigger('wboost-interactions-channel', 'wboost-new-message-event', [
                    'interaction' => $this->interactionModel->get_new_interaction_message($wb_message['interaction_id'], $wb_message['id'])
                ]);
            }
        }
        if (isset($changed_data['messages'])) {
            $message = reset($changed_data['messages']);
            if (!empty($message)) {
                $trigger_msg = (!empty($message['interactive'])) ? $message['interactive']['button_reply']['id'] : (isset($message['button']['text']) ? $message['button']['text'] : $message['text']['body']);
                $contact     = reset($changed_data['contacts']);
                $metadata    = $changed_data['metadata'];
                try {
                    $contact_number = $message['from'];
                    $contact_data   = $this->whatsboostModel->getContactData($contact_number, $contact['profile']['name']);
                    
                    $query_trigger_msg = $trigger_msg;
                    $reply_type = null;
                    if ($this->is_first_time) {
                        $query_trigger_msg = "";
                        $reply_type = 3;
                    }
                    
                    // Fetch template and message bots based on interaction
                    $template_bots = $this->campaignModel->getTemplateBotsbyRelType($contact_data['rel_type'] ?? '', $query_trigger_msg, $reply_type);
                    $message_bots  = $this->botsModel->getMessageBotsbyRelType($contact_data['rel_type'] ?? '', $query_trigger_msg, $reply_type);
                    $get_flows = $this->botFlowModel->getFlows($contact_data['rel_type'] ?? '', $query_trigger_msg, true);

                    $add_messages = function ($item) {
                        $item['header_message'] = $item['header_data_text'];
                        $item['body_message']   = $item['body_data'];
                        $item['footer_message'] = $item['footer_data'];

                        return $item;
                    };

                    // Map template bots
                    $template_bots = array_map($add_messages, $template_bots);
                    $chatMessage   = [];

                    // Iterate over template bots
                    foreach ($template_bots as $template) {
                        $template['rel_id'] = $contact_data['id'];
                        if (!empty($contact_data['userid'])) {
                            $template['userid'] = $contact_data['userid'];
                        }

                        // Send template on exact match, contains, or first time
                        if ((1 == $template['bot_type'] && in_array(strtolower($query_trigger_msg), array_map("trim", array_map("strtolower", explode(',', $template['trigger']))))) || 2 == $template['bot_type'] || (3 == $template['bot_type'] && $this->is_first_time) || 4 == $template['bot_type']) {
                            $response   = $this->sendTemplate($contact_data, $template, 'template', $metadata['phone_number_id']);
                            $logBatch[] = $response['log_data'];
                            if ($response['status']) {
                                $interactionId = wbGetInteractionId($template, $template['rel_type'], $contact_data['id'], $contact_data['company_name'], $contact_number, $changed_data['metadata']['display_phone_number'], $contact_data);
                                $chatMessage[] = $this->store_bot_messages($template, $interactionId, $contact_data, 'template_bot', $response);
                            }
                        }
                    }

                    // Iterate over message bots
                    foreach ($message_bots as $message) {
                        $message['rel_id'] = $contact_data['id'];
                        if ((1 == $message['reply_type'] && in_array(strtolower($query_trigger_msg), array_map("trim", array_map("strtolower", explode(',', $message['trigger']))))) || 2 == $message['reply_type'] || (3 == $message['reply_type'] && $this->is_first_time) || 4 == $message['reply_type']) {
                            $response = $this->sendMessage($contact_data, $message, $metadata['phone_number_id']);
                            if ($response['status']) {
                                $interactionId = wbGetInteractionId($message, $message['rel_type'], $contact_data['id'], $contact_data['company_name'], $contact_number, $changed_data['metadata']['display_phone_number'], $contact_data);
                                $chatMessage[] = $this->store_bot_messages($message, $interactionId, $contact_data, '', $response);
                            }
                        }
                    }
                    
                    // Iterate over flow bots 
                    foreach ($get_flows as $message) {
                        $message['rel_id'] = $contact_data['id'];
                        if ((1 == $message['reply_type'] && in_array(strtolower($query_trigger_msg), array_map("trim", array_map("strtolower", explode(',', $message['trigger']))))) || (2 == $message['reply_type'] && is_numeric(stripos($query_trigger_msg, $message['trigger']))) || (3 == $message['reply_type'] && $this->is_first_time) || 4 == $message['reply_type']) {
                            $response = $this->sendMessage($contact_data, $message, $metadata['phone_number_id'], "flow");
                            if ($response['status']) {
                                $interactionId = wbGetInteractionId($message, $message['rel_type'], $contact_data['id'], $contact_data['company_name'], $contact_number, $changed_data['metadata']['display_phone_number']);
                                $chatMessage[] = $this->store_bot_messages($message, $interactionId, $contact_data, 'flow', $response);
                            }
                        }
                    }

                    // Add chat messages to database
                    $this->whatsboostModel->addChatMessage($chatMessage);
                    // // Add template bot logs
                    $this->whatsboostModel->addWhatsboostLog($logBatch ?? []);
                } catch (\Throwable $th) {
                    file_put_contents(FCPATH . '/errors.json', json_encode([$th->getMessage()]));
                }
            }
        }
    }

    public function getdata($payload)
    {
        // Extract entry and changes
        $entry   = array_shift($payload['entry']);
        $changes = array_shift($entry['changes']);
        $value   = $changes['value'];

        // Check if payload contains messages
        if (isset($value['messages'])) {
            $messageEntry = array_shift($value['messages']);
            $contact      = array_shift($value['contacts']) ?? '';
            $name         = $contact['profile']['name'] ?? '';
            $from         = $messageEntry['from'];
            $metadata     = $value['metadata'];
            $wa_no        = $metadata['display_phone_number'];
            $wa_no_id     = $metadata['phone_number_id'];
            $messageType  = $messageEntry['type'];
            $message_id   = $messageEntry['id'];
            $ref_message_id = isset($messageEntry['context']) ? $messageEntry['context']['id'] : '';

            $this->is_first_time = !(bool) wb_total_rows(get_db_prefix() . 'wb_interactions', ['receiver_id' => $from]);

            // Extract message content based on type
            switch ($messageType) {
                case 'text':
                    $message = $messageEntry['text']['body'];
                    break;
                case 'interactive':
                    $message = $messageEntry['interactive']['button_reply']['title'];
                    break;
                case 'button':
                    $message = $messageEntry['button']['text'];
                    break;
                case 'reaction':
                    $emoji        = $messageEntry['reaction']['emoji'];
                    $decodedEmoji = json_decode('"' . $emoji . '"', false, 512, \JSON_UNESCAPED_UNICODE);
                    $message      = $decodedEmoji;
                    break;
                case 'image':
                case 'audio':
                case 'document':
                case 'video':
                    $media_id     = $messageEntry[$messageType]['id'];
                    $caption      = $messageEntry[$messageType]['caption'] ?? null;
                    $access_token = get_setting('wb_access_token');
                    $attachment   = $this->retrieveUrl($media_id, $access_token);
                    break;
                default:
                    $message = ''; // Default to empty string
                    break;
            }

            if (!$this->is_first_time) {
                $contacts = $this->whatsboostModel->getContactData($from, $name);
                $type = $contacts['rel_type'];
                $type_id = $contacts['id'];
            }

            // Save message to database
            $interaction_id = $this->interactionModel->insert_interaction([
                'receiver_id'   => $from,
                'wa_no'         => $wa_no,
                'wa_no_id'      => $wa_no_id,
                'name'          => $name,
                'last_message'  => $message ?? $messageType,
                'time_sent'     => wbGetCurrentTimestamp(),
                'last_msg_time' => wbGetCurrentTimestamp(),
                'type'          => $type ?? '',
                'type_id'       => $type_id ?? '',
            ]);

            $interaction = $this->interactionModel->get_interaction($interaction_id);
            $this->interactionModel->map_interaction($interaction);

            // Insert interaction message data into the 'whatsapp_official_interaction_messages' table
            $new_message_id = $this->interactionModel->insert_interaction_message([
                'interaction_id' => $interaction_id,
                'sender_id'      => $from,
                'message_id'     => $message_id,
                'message'        => $message ?? $caption ?? '',
                'type'           => $messageType,
                'staff_id'       => $_SESSION['user_id'] ?? null,
                'url'            => $attachment ?? null,
                'status'         => 'sent',
                'time_sent'      => wbGetCurrentTimestamp(),
                'ref_message_id' => $ref_message_id,
            ]);

            if (!empty(get_setting('pusher_app_key')) || !empty(get_setting('pusher_app_secret')) || !empty(get_setting('pusher_app_id'))) {
                $this->pusher->trigger('wboost-interactions-channel', 'wboost-new-message-event', [
                    'interaction' => json_encode($this->interactionModel->get_new_interaction_message($interaction_id, $new_message_id))
                ]);
            }

            // Respond with success message
            http_response_code(200);
        } elseif (isset($value['statuses'])) {
            $statusEntry = array_shift($value['statuses']);
            $id          = $statusEntry['id'];
            $status      = $statusEntry['status'];
            $this->interactionModel->update_message_status($id, $status);

            $status_id = $statusEntry['id'];
            $wb_message = $this->interactionModel->get_message(['message_id' => $status_id]);
            $wb_message = reset($wb_message);
            if (!empty(get_setting('pusher_app_key')) || !empty(get_setting('pusher_app_secret')) || !empty(get_setting('pusher_app_id'))) {
                $this->pusher->trigger('wboost-interactions-channel', 'wboost-new-message-event', [
                    'interaction' => json_encode($this->interactionModel->get_new_interaction_message($wb_message['interaction_id'], $wb_message['id']))
                ]);
            }
        } else {
            // Invalid payload structure
            $this->response
                ->setStatusCode(400)
                ->setBody('Invalid payload structure');
        }
    }

    public function send_message()
    {
        // Retrieve POST data
        $id                   = $this->request->getPost('id') ?? '';
        $type                 = $this->request->getPost('type') ?? '';
        $type_id              = $this->request->getPost('type_id') ?? '';
        $existing_interaction = $this->interactionModel->get_interaction($id, $type, $type_id);
        $to                   = $this->request->getPost('to') ?? '';
        $message              = strip_tags($this->request->getPost('message') ?? '');
        $ref_message_id       = $this->request->getPost('ref_message_id');

        if (($type == 'contacts' || $type == 'leads') && !empty($type_id)) {
            switch ($type) {
                case 'leads':
                    $options       = ['id' => $type_id, 'is_lead' => 1, 'deleted' => 0];
                    $rel_data      = $this->clientsModel->get_details($options)->getRowArray();
                    break;

                case 'contacts':
                    $options       = ['id' => $type_id, 'is_lead' => 0, 'deleted' => 0];
                    $rel_data      = $this->clientsModel->get_details($options)->getRowArray();
                    break;
            }

            $message_data         = wbParseMessageText([
                'rel_type' => $type,
                'rel_id' => $type_id,
                'reply_text' => $message,
            ], $rel_data);
        }
        $message = $message_data['reply_text'] ?? $message;

        $imageAttachment      = $_FILES['image'] ?? null;
        $videoAttachment      = $_FILES['video'] ?? null;
        $documentAttachment   = $_FILES['document'] ?? null;
        $audioAttachment      = $_FILES['audio'] ?? null;

        // Initialize message data
        $message_data = [];

        // Check if there is only text message or only attachment
        if (!empty($message)) {
            // Send only text message
            $message_data[] = [
                'type' => 'text',
                'text' => [
                    'preview_url' => true,
                    'body'        => $message,
                ],
            ];
        }

        // Handle audio attachment
        if (!empty($audioAttachment)) {
            $audio_url      = $this->handle_attachment_upload($audioAttachment);
            $message_data[] = [
                'type'  => 'audio',
                'audio' => [
                    'url' => base_url('files/whatsboost/' . $audio_url),  // Prepend base URL to audio file name
                ],
            ];
        }

        // Handle image attachment
        if (!empty($imageAttachment)) {
            $image_url      = $this->handle_attachment_upload($imageAttachment);
            $message_data[] = [
                'type'  => 'image',
                'image' => [
                    'url' => base_url('files/whatsboost/' . $image_url),  // Prepend base URL to image file name
                ],
            ];
        }

        // Handle video attachment
        if (!empty($videoAttachment)) {
            $video_url      = $this->handle_attachment_upload($videoAttachment);
            $message_data[] = [
                'type'  => 'video',
                'video' => [
                    'url' => base_url('files/whatsboost/' . $video_url),  // Prepend base URL to video file name
                ],
            ];
        }

        // Handle document attachment
        if (!empty($documentAttachment)) {
            $document_url = $this->handle_attachment_upload($documentAttachment);

            $message_data[] = [
                'type'     => 'document',
                'document' => [
                    'url' => base_url('files/whatsboost/' . $document_url),  // Prepend base URL to document file name
                ],
            ];
        }

        $whatsapp_cloud_api = new WhatsAppCloudApi([
            'from_phone_number_id' => $existing_interaction['wa_no_id'],
            'access_token'         => get_setting('wb_access_token'),
        ]);

        $messageId = null;

        foreach ($message_data as $data) {
            switch ($data['type']) {
                case 'text':
                    $response = $whatsapp_cloud_api->sendTextMessage($to, $data['text']['body']);
                    break;
                case 'audio':
                    $response = $whatsapp_cloud_api->sendAudio($to, new LinkID($data['audio']['url']));
                    break;
                case 'image':
                    $response = $whatsapp_cloud_api->sendImage($to, new LinkID($data['image']['url']));
                    break;
                case 'video':
                    $response = $whatsapp_cloud_api->sendVideo($to, new LinkID($data['video']['url']));
                    break;
                case 'document':
                    $fileName = basename($data['document']['url']);
                    $response = $whatsapp_cloud_api->sendDocument($to, new LinkID($data['document']['url']), $fileName, '');
                    break;
            }

            // Decode the response JSON
            $response_data = $response->decodedBody();

            // Check if the response data contains the message ID
            if (isset($response_data['messages'][0]['id'])) {
                // Message sent successfully, store the message ID
                $messageId = $response_data['messages'][0]['id'];
            }
        }

        // Insert message into the database
        $interaction_id = $this->interactionModel->insert_interaction([
            'receiver_id'  => $to,
            'last_message' => $message ?? ($message_data[0]['type'] ?? ''), // Ensure fallback in case message_data is not set
            'wa_no'        => $existing_interaction['wa_no'],
            'wa_no_id'     => $existing_interaction['wa_no_id'],
            'time_sent'    => wbGetCurrentTimestamp(),
            'type'         => $type ?? '',
            'type_id'      => $type_id ?? 0,
        ]);

        foreach ($message_data as $data) {
            $new_message_id = $this->interactionModel->insert_interaction_message([
                'interaction_id' => $interaction_id,
                'sender_id'      => $existing_interaction['wa_no'], // Accessing object property directly
                'message'        => $message,
                'message_id'     => $messageId,
                'type'           => $data['type'] ?? '', // Ensure fallback in case message_data['type'] is not set
                'staff_id'       => $_SESSION['user_id'] ?? null,
                'url'            => isset($data[$data['type']]['url']) ? basename($data[$data['type']]['url']) : null, // Check if URL exists before accessing
                'status'         => 'sent',
                'time_sent'      => wbGetCurrentTimestamp(),
                'ref_message_id' => $ref_message_id ?? '',
            ]);
            if (!empty(get_setting('pusher_app_key')) || !empty(get_setting('pusher_app_secret')) || !empty(get_setting('pusher_app_id'))) {
                $this->pusher->trigger('wboost-interactions-channel', 'wboost-new-message-event', [
                    'interaction' => json_encode($this->interactionModel->get_new_interaction_message($interaction_id, $new_message_id))
                ]);
            }
        }

        // Return success response
        echo json_encode(['success' => true]);
    }

    public function mark_interaction_as_read()
    {
        // Retrieve POST data
        $interaction_id = $_POST['interaction_id'] ?? '';

        // Validate input
        if (empty($interaction_id)) {
            echo json_encode(['error' => 'Invalid interaction ID']);

            return;
        }

        // Call the model function to mark the interaction as read
        $success = $this->interactionModel->update_message_status($interaction_id, 'read');

        // Check if the interaction was successfully marked as read
        if ($success) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Failed to mark interaction as read']);
        }
    }

    public function template_category_update($changed_data)
    {
        $this->whatsboostModel->updateCategory(get_db_prefix() . 'wtc_templates', ['category' => $changed_data['new_category']], ['template_id' => $changed_data['message_template_id']]);
    }

    public function store_bot_messages($data, $interactionId, $rel_data, $type, $response)
    {
        $data['sending_count'] = (int) $data['sending_count'] + 1;
        if ('template_bot' == $type && !empty($response['status'])) {
            $header = wbParseText($rel_data, 'header', $data);
            $body   = wbParseText($rel_data, 'body', $data);
            $footer = wbParseText($rel_data, 'footer', $data);

            $buttonHtml = '';
            if (!empty(json_decode($data['buttons_data']))) {
                $buttons    = json_decode($data['buttons_data']);
                $buttonHtml = "<div class='d-flex gap-2 w-100 px-1 flex-column mt-3'>";
                foreach ($buttons->buttons as $key => $value) {
                    $buttonHtml .= '<button class="btn btn-default w-100">' . $value->text . '</button>';
                }
                $buttonHtml .= '</div>';
            }

            $header_data = '';
            if ('IMAGE' == $data['header_data_format'] && wbIsImage(getcwd() . '/files/whatsboost/template/' . $data['filename'])) {
                $header_data = '<a href="' . base_url('/files/whatsboost/template/' . $data['filename']) . '" data-lightbox="image-group"><img src="' . base_url('/files/whatsboost/template/' . $data['filename']) . '" class="img-responsive img-rounded" style="width: 300px"></img></a>';
            } elseif ('TEXT' == $data['header_data_format'] || '' == $data['header_data_format']) {
                $header_data = "<div class='my-1 bold'>" . nl2br(wbDecodeWhatsAppSigns($header ?? '')) . '</div>';
            } elseif ('DOCUMENT' == $data['header_data_format']) {
                $header_data = '<a href="' . base_url(getcwd() . '/files/whatsboost/template/' . $data['filename']) . '" target="_blank" class="btn btn-default tw-w-full">' . app_lang('document') . '</a>';
            }

            $this->whatsboostModel->updateSendingCount(get_db_prefix() . 'wb_campaigns', $data['sending_count'], $data['campaign_table_id']);

            // Prepare the data for chat message
            return [
                'interaction_id' => $interactionId,
                'sender_id'      => $this->getDefaultPhoneNumber(),
                'url'            => null,
                'message'        => "<div class='p-2'>" . "
                            $header_data
                            <p>" . nl2br(wbDecodeWhatsAppSigns($body)) . "</p>
                            <span class='text-muted small'>" . nl2br(wbDecodeWhatsAppSigns($footer ?? '')) . "</span>
                            $buttonHtml
                        " . '</div>',
                'status'     => 'sent',
                'time_sent'  => wbGetCurrentTimestamp(),
                'message_id' => $response['data']->messages[0]->id,
                'staff_id'   => 0,
                'type'       => 'text',
            ];
        }
        $type = $type == 'flow' ? 'flow' : 'bot';
        $data   = wbParseMessageText($data, $rel_data);
        $header = $data['bot_header'];
        $body   = $data['reply_text'];
        $footer = $data['bot_footer'];

        $header_image = '';
        $buttonHtml   = '';
        $extensions = wbGetAllowedExtension();

        $option = false;
        if (!empty($data['button1']) || !empty($data['button2']) || !empty($data['button3'])) {
            $buttonHtml .= "<div class='d-flex gap-2 w-100 px-1 flex-column mt-3'>";
            if (!empty($data['button1_id'])) {
                $buttonHtml .= '<button class="btn btn-default w-100">' . $data['button1'] . '</button>';
                $option = true;
            }
            if (!empty($data['button2_id'])) {
                $buttonHtml .= '<button class="btn btn-default w-100">' . $data['button2'] . '</button>';
                $option = true;
            }
            if (!empty($data['button3_id'])) {
                $buttonHtml .= '<button class="btn btn-default w-100">' . $data['button3'] . '</button>';
                $option = true;
            }
            $buttonHtml .= '</div>';
        }
        if (!$option && !empty($data['button_name']) && !empty($data['button_url']) && filter_var($data['button_url'], \FILTER_VALIDATE_URL)) {
            $buttonHtml .= '<a href="' . $data['button_url'] . '" class="btn btn-default w-100 mt-10"><i data-feather="share" class="icon-16 me-2"></i>' . $data['button_name'] . '</a>';
            $option = true;
        }
        if (!$option && wbIsImage(getcwd() . '/files/whatsboost/' . $type . '/' . $data['filename'])) {
            $header_image = '<a href="' . base_url('files/whatsboost/bot/' . $data['filename']) . '" data-lightbox="image-group"><img src="' . base_url('files/whatsboost/bot/' . $data['filename']) . '" class="img-responsive img-rounded" style="width: 300px"></img></a>';
        }
        if (!$option && !empty($data['filename']) && in_array('.' . wb_get_file_extension($data['filename']), array_map('trim', explode(',', $extensions['image']['extension'])))) {
            $header_image = '<a href="' . base_url('files/whatsboost/' . $type . '/' . $data['filename']) . '" data-lightbox="image-group"><img src="' . base_url('files/whatsboost/' . $type . '/' . $data['filename']) . '" class="img-responsive img-rounded" style="width: 300px"></img></a>';
        }
        if (!$option && !empty($data['filename']) && in_array('.' . wb_get_file_extension($data['filename']), array_map('trim', explode(',', $extensions['document']['extension'])))) {
            $header_image = '<a href="' . base_url('files/whatsboost/' . $type . '/' . $data['filename']) . '" target="_blank" class="btn btn-default tw-w-full">' . app_lang('document') . '</a>';
        }
        if (!$option && !empty($data['filename']) && in_array('.' . wb_get_file_extension($data['filename']), array_map('trim', explode(',', $extensions['video']['extension'])))) {
            $header_image = '<video src="' . base_url('files/whatsboost/' . $type . '/' . $data['filename']) . '" controls class="rounded" style="width: 300px"></video>';
        }
        if (!$option && !empty($data['filename']) && in_array('.' . wb_get_file_extension($data['filename']), array_map('trim', explode(',', $extensions['audio']['extension'])))) {
            $header_image = '<audio controls class="w-[250px]"><source src="' . base_url('files/whatsboost/' . $type . '/' . $data['filename']) . '"  type="audio/mpeg"  style="width: 300px"></audio>';
        }
        $buttonHtml .= '</div>';

        $this->whatsboostModel->updateSendingCount(get_db_prefix() . 'wb_bot', $data['sending_count'], $data['id']);

        return [
            'interaction_id' => $interactionId,
            'sender_id'      => $this->getDefaultPhoneNumber(),
            'url'            => null,
            'message'        => "<div class='d-flex flex-column gap-2 p-1'>" . $header_image . "<span class='my-1 bold'>" . nl2br(wbDecodeWhatsAppSigns($header ?? '')) . '</span><span>' . nl2br(wbDecodeWhatsAppSigns($body)) . "</span><span class='text-muted small'>" . nl2br(wbDecodeWhatsAppSigns($footer ?? '')) . "</span> $buttonHtml " . '</div>',
            'status'     => 'sent',
            'time_sent'  => wbGetCurrentTimestamp(),
            'message_id' => $response['data']->messages[0]->id,
            'staff_id'   => 0,
            'type'       => 'text',
        ];
    }
}
