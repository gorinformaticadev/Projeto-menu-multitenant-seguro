<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="row">
        <div class="col-sm-3 col-lg-2">
            <?php
            $tab_view['active_tab'] = 'whatsboost';
            echo view('settings/tabs', $tab_view);
            ?>
        </div>
        <div class="col-sm-9 col-lg-10">
            <div class="card">
                <ul data-bs-toggle="ajax-tab" class="nav nav-tabs bg-white title" role="tablist">
                    <li><a role="presentation" data-bs-toggle="tab" href="javascript:;" data-bs-target="#whatsapp-auto-lead"><?php echo app_lang('whatsapp_auto_lead'); ?></a></li>
                    <li><a role="presentation" data-bs-toggle="tab" href="#" data-bs-target="#webhooks"><?php echo app_lang('webhooks'); ?></a></li>
                    <li><a role="presentation" data-bs-toggle="tab" href="javascript:;" data-bs-target="#support_agent"><?php echo app_lang('support_agent'); ?></a></li>
                    <li><a role="presentation" data-bs-toggle="tab" href="#" data-bs-target="#notification_sound"><?php echo app_lang('notification_sound'); ?></a></li>
                    <li><a role="presentation" data-bs-toggle="tab" href="#" data-bs-target="#ai_integration"><?php echo app_lang('ai_integration'); ?></a></li>
                    <li><a role="presentation" data-bs-toggle="tab" href="#" data-bs-target="#auto_clear_chat_history"><?php echo app_lang('auto_clear_chat_history'); ?></a></li>

                </ul>
                <div class="tab-content">
                    <div role="tabpanel" class="tab-pane fade" id="whatsapp-auto-lead">
                        <?php echo form_open(get_uri('whatsboost/save_settings'), ['id' => 'whatsboost-settings-form', 'class' => 'general-form dashed-row', 'role' => 'form']); ?>
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label"><?php echo app_lang('convert_new_whatsapp_messages_to_lead'); ?></label>
                                <div class="form-check form-switch">
                                    <input type="checkbox" class="form-check-input" value="1" id="wb_auto_lead_settings" name="wb_auto_lead_settings" <?php echo (1 == get_setting('wb_auto_lead_settings') ? 'checked' : ''); ?>>
                                    <label class="form-check-label" for="wb_auto_lead_settings"></label>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-4">
                                    <label for="leads_status" class="form-label"><?php echo app_lang('lead_status'); ?></label>
                                    <?php
                                    foreach ($statuses as $status) {
                                        $lead_status[$status->id] = $status->title;
                                    }
                                    echo form_dropdown([
                                        'name'  => 'wb_auto_lead_status',
                                        'id'    => 'wb_auto_lead_status',
                                        'class' => 'form-control validate-hidden select2',
                                    ], $lead_status, get_setting('wb_auto_lead_status'));
                                    ?>

                                </div>
                                <div class="col-md-4">
                                    <label for="leads_source" class="form-label"><?php echo app_lang('source'); ?></label>
                                    <?php
                                    $lead_source = [];

                                    foreach ($sources as $source) {
                                        $lead_source[$source->id] = $source->title;
                                    }

                                    echo form_dropdown([
                                        'name'  => 'wb_auto_lead_source',
                                        'id'    => 'wb_auto_lead_source',
                                        'class' => 'form-control validate-hidden select2',
                                    ], $lead_source, get_setting('wb_auto_lead_source'));
                                    ?>
                                </div>
                                <div class="col-md-4 ">
                                    <label for="leads_assigned" class="form-label"><?php echo app_lang('owner'); ?></label>
                                    <span class="help" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('the_person_who_will_manage_this_lead'); ?>"><i data-feather="help-circle" class="icon-16"></i></span>
                                    <?php
                                    $lead_owner = [];

                                    foreach ($owners as $owner) {
                                        $lead_owner[$owner['id']] = $owner['text'];
                                    }

                                    echo form_dropdown([
                                        'name'  => 'wb_auto_lead_owner',
                                        'id'    => 'wb_auto_lead_owner',
                                        'class' => 'form-control validate-hidden select2',
                                    ], $lead_owner, get_setting('wb_auto_lead_owner'));
                                    ?>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div role="tabpanel" class="tab-pane fade" id="webhooks">
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label"><?php echo app_lang('enable_webhooks_re_send'); ?></label>
                                <div class="col-12">
                                    <div class="form-check form-switch">
                                        <input type="checkbox" class="form-check-input" value="1" id="wb_enable_webhooks_re_send" name="wb_enable_webhooks_re_send" <?php echo (1 == get_setting('wb_enable_webhooks_re_send') ? 'checked' : ''); ?>>
                                        <label class="form-check-label" for="wb_enable_webhooks_re_send"></label>
                                    </div>
                                </div>

                                <div class="col-md-4 mt-3">
                                    <label for="leads_assigned" class="form-label"><?php echo app_lang('webhook_resend_method'); ?></label>
                                    <?php
                                    echo form_dropdown([
                                        'name'  => 'wb_webhook_resend_method',
                                        'id'    => 'wb_webhook_resend_method',
                                        'class' => 'form-control validate-hidden select2',
                                    ], ['GET' => 'GET', 'POST' => 'POST'], get_setting('wb_webhook_resend_method'));
                                    ?>
                                </div>

                                <div class="mt-3">
                                    <label class="form-label"><?php echo app_lang('whatsapp_received_data_will_be_resend_to'); ?></label>
                                    <div class="col-12 mt-1">
                                        <?php echo form_input([
                                            'id'    => 'wb_webhook_resend_url',
                                            'name'  => 'wb_webhook_resend_url',
                                            'value' => get_setting('wb_webhook_resend_url'),
                                            'class' => 'form-control',
                                        ]); ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div role="tabpanel" class="tab-pane fade" id="support_agent">
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label"><?php echo app_lang('assign_chat_permission_to_support_agent'); ?></label>
                                <div class="col-12">
                                    <div class="form-check form-switch">
                                        <input type="checkbox" class="form-check-input" value="1" id="wb_enable_supportagent" name="wb_enable_supportagent" <?php echo (1 == get_setting('wb_enable_supportagent') ? 'checked' : ''); ?>>
                                        <label class="form-check-label" for="wb_enable_supportagent"></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-body pt-0">
                            <div class="col-md-12">
                                <div class="alert alert-warning">
                                    <?= app_lang('support_agent_note'); ?>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div role="tabpanel" class="tab-pane fade" id="notification_sound">
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label"><?php echo app_lang('enable_whatsapp_notification_sound'); ?></label>
                                <div class="col-12">
                                    <div class="form-check form-switch">
                                        <input type="checkbox" class="form-check-input" value="1" id="wb_enable_notification_sound" name="wb_enable_notification_sound" <?php echo (1 == get_setting('wb_enable_notification_sound') ? 'checked' : ''); ?>>
                                        <label class="form-check-label" for="wb_enable_notification_sound"></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div role="tabpanel" class="tab-pane fade" id="ai_integration">
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label"><?php echo app_lang('enable_wb_openai'); ?></label>
                                <div class="col-12">
                                    <div class="form-check form-switch">
                                        <input type="checkbox" class="form-check-input" value="1" id="enable_wb_openai" name="enable_wb_openai" <?php echo (1 == get_setting('enable_wb_openai') ? 'checked' : ''); ?>>
                                        <label class="form-check-label" for="enable_wb_openai"></label>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <label class="form-label"><?php echo app_lang('open_ai_secret_key'); ?></label>
                                    <div class="col-md-12">
                                        <?php echo form_input([
                                            'id'    => 'wb_open_ai_key',
                                            'name'  => 'wb_open_ai_key',
                                            'value' => get_setting('wb_open_ai_key'),
                                            'class' => 'form-control',
                                        ]); ?>
                                    </div>
                                </div>
                                <div class="row openai_model mt-3">
                                    <label for="chat_model" class="form-label"><?php echo app_lang('chat_model'); ?></label>
                                    <div class="col-md-6 mt-1">
                                        <?php
                                        echo form_dropdown([
                                            'name'  => 'wb_openai_model',
                                            'id'    => 'wb_openai_model',
                                            'class' => 'form-control validate-hidden select2',
                                        ], wb_openai_models(), get_setting('wb_openai_model'));
                                        ?>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    <!-- Auto Clear Chat History  START-->
                    <div role="tabpanel" class="tab-pane fade" id="auto_clear_chat_history">
                        <div class="card-body post-dropzone">
                            <div class="mb-3">
                                <label class="form-label" for="enable_clear_chat_history"><?php echo app_lang('enable_auto_clear_chat_history'); ?></label>
                                <div class="col-12">
                                    <div class="form-check form-switch">
                                        <input type="checkbox" class="form-check-input" value="1" id="enable_clear_chat_history" name="wb_enable_clear_chat_history" <?php echo (1 == get_setting('wb_enable_clear_chat_history') ? 'checked' : ''); ?>>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <label class="form-check-label" for="auto_clear_history_time"><?php echo app_lang('auto_clear_history_time'); ?></label>
                                    <div class="input-group mb-3 w-25">
                                        <input type="number" class="form-control" name="wb_auto_clear_history_time" min='1' id="auto_clear_history_time"
                                        value=<?php echo get_setting('wb_auto_clear_history_time') ?>>
                                        <span class="input-group-text" id="basic-addon2"><?= app_lang('days')?></span>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-12">
                                        <!-- Warning Alert -->
                                        <div class="alert alert-warning">
                                        <?php echo app_lang('auto_clear_history_note')?>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <!-- Danger Alert -->
                                        <div class="alert alert-danger">
                                            This feature requires a properly configured cron job. Before activating the feature, make sure that the
                                            <a href="<?php echo get_uri('settings/cron_job')?>" class="text-decoration-underline">cron job</a>
                                            is configured as explained in the documentation.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Auto Clear Chat History  END -->

                    <div class="card-footer">
                        <button type="submit" class="btn btn-primary"><span data-feather="check-circle" class="icon-16"></span><?php echo app_lang('save'); ?></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    "use strict";
    $('#wb_auto_lead_status, #wb_auto_lead_source, #wb_auto_lead_owner, #wb_webhook_resend_method, #wb_openai_model').select2();

    $("#whatsboost-settings-form").on('submit', function(event) {
        event.preventDefault();
        $.ajax({
            url: `<?php echo get_uri('whatsboost/save_settings'); ?>`,
            type: 'POST',
            dataType: 'html',
            data: $(this).serializeArray(),
            success: function(response) {
                response = JSON.parse(response);
                console.log(response.status);
                if (response.status == true) {
                    appAlert.success(response.message, {
                        duration: 10000
                    });
                } else {
                    appAlert.error(response.message, {
                        duration: 10000
                    });
                }
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
        })
    });
</script>
