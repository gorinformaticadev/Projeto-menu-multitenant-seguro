<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <h4 class="fw-semibold"><?php echo app_lang('connect_whatsapp_business'); ?></h4>
    <p class="text-muted"><?php echo app_lang('connect_your_whatsapp_account'); ?></p>
    <div class="row">
        <div class="col-md-6">
            <?php echo form_open(get_uri('whatsboost/connect_account'), ['id' => 'connect-account-form']); ?>
            <div class="card rounded-bottom">
                <div class="card-body">
                    <h3 class="text-success"><?php echo app_lang('whatsapp'); ?></h3>
                    <p class="d-flex align-items-end mb-0">
                        <span class="badge rounded-circle" style="background-color:rgb(34 197 94); padding: 0.7rem;">
                        </span> &nbsp; <?php echo app_lang('one_click_account_connection'); ?>
                    </p>
                    <div class="mt-5">
                        <div class="mb-3">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('your_whatsapp_business_account'); ?>" data-bs-placement="top"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="wb_business_account_id" class="form-label"><?php echo app_lang('whatsapp_business_account_id'); ?></label>
                            <input type="text" class="form-control" id="wb_business_account_id" name="wb_business_account_id" value="<?php echo get_setting('wb_business_account_id'); ?>">
                        </div>
                        <div class="mb-3">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('your_user_access_token_after_signing'); ?>" data-bs-placement="top"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="wb_access_token" class="form-label"><?php echo app_lang('whatsapp_access_token'); ?></label>
                            <input type="text" class="form-control" id="wb_access_token" name="wb_access_token" value="<?php echo get_setting('wb_access_token'); ?>">
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <h6 class="fw-semibold"><?php echo app_lang('webhook_callback_url'); ?></h6>
                                <a href="#" class="copyText"><?php echo get_uri('whatsboost/whatsapp_webhook'); ?></a>
                                <span class="badge bg-secondary float-end copyBtn"><?php echo app_lang('copy'); ?></span>
                            </div>
                            <div class="col-md-12">
                                <h6 class="fw-semibold"><?php echo app_lang('verify_token'); ?></h6>
                                <span class="copyText"><?php echo get_setting('wb_verify_token'); ?></span>
                                <span class="badge bg-secondary float-end copyBtn"><?php echo app_lang('copy'); ?></span>
                            </div>
                        </div>
                    </div>
                    <hr>
                    <?php if (!$isConnected) { ?>
                        <button type="button" class="btn btn-success submitbtn" name="submit" value="submit"><i data-feather="link" class="icon-16"></i>
                            <?php echo app_lang('connect'); ?></button>
                    <?php } else { ?>
                        <button type="button" name="submit" class="btn btn-success submitbtn"><i data-feather="edit-2" class="icon-16"></i> <?php echo app_lang('update_details'); ?></button>
                        <button type="button" class="btn btn-danger disconnectbtn" formaction="<?php echo get_uri('whatsboost/disconnect'); ?>"><i data-feather="x" class="icon-16"></i>
                            <?php echo app_lang('disconnect'); ?></button>
                    <?php } ?>
                </div>
            </div>
            <?php echo form_close(); ?>
        </div>
        <div class="col-md-6">
            <?php foreach ($phoneNumbers as $phoneNumber) {
    $isDefault = ($phoneNumber->id == get_setting('wb_phone_number_id')); ?>
                <div class="card rounded-bottom mb-4">
                    <div class="card-header <?php echo ($isDefault) ? 'bg-success' : 'bg-info text-white'; ?>">
                        <span><i data-feather="phone" class="icon-16"></i>
                            <strong><?php echo $phoneNumber->display_phone_number; ?></strong></span>
                    </div>
                    <div class="card-body">
                        <p><i data-feather="book" class="icon-16 text-info"></i>
                            <strong><?php echo app_lang('verified_name'); ?>
                                :</strong>
                            <?php echo $phoneNumber->verified_name; ?>
                        </p>
                        <p><i data-feather="check-circle" class="icon-16 text-success"></i>
                            <strong><?php echo app_lang('number_id'); ?> :</strong>
                            <?php echo $phoneNumber->id; ?>
                        </p>
                        <p><i data-feather="star" class="icon-16 text-success"></i>
                            <strong><?php echo app_lang('quality'); ?> :</strong><span>
                                <?php echo $phoneNumber->quality_rating; ?></span>
                        </p>
                        <p><i data-feather="clock" class="icon-16 text-warning"></i>
                            <strong><?php echo app_lang('status'); ?> :</strong><span>
                                <?php echo $phoneNumber->code_verification_status; ?></span>
                        </p>
                    </div>
                    <div class="card-footer">
                        <?php if ($isDefault) { ?>
                            <span class="badge bg-success"><?php echo app_lang('currently_using_this_number'); ?></span>
                        <?php } else { ?>
                            <a href="#" class="btn btn-info mark_as_default text-white" data-phone_number_id="<?php echo $phoneNumber->id; ?>" data-phone_number="<?php echo $phoneNumber->display_phone_number; ?>">
                                <i data-feather="check-circle" class="icon-16"></i>
                                <?php echo app_lang('mark_as_default'); ?>
                            </a>
                        <?php } ?>
                    </div>
                </div>
            <?php
} ?>
        </div>
    </div>
</div>

<script>
    "use strict";
    $(function() {
        $('.copyBtn').on('click', function() {
            var textToCopy = $(this).prev('.copyText').text();
            var tempInput = $('<textarea>');
            tempInput.val(textToCopy);
            $('body').append(tempInput);
            tempInput.select();
            tempInput[0].setSelectionRange(0, 99999);
            document.execCommand('copy');
            tempInput.remove();
            $(this).text('<?php echo app_lang('copied'); ?>');
            setTimeout(() => {
                $(this).text('<?php echo app_lang('copy'); ?>');
            }, 1000);
        });

        $('.mark_as_default').on('click', function() {
            $.ajax({
                url: `<?php echo get_uri('whatsboost/set_default_phone_number_id'); ?>`,
                data: {
                    wb_phone_number_id: $(this).data('phone_number_id'),
                    wb_default_phone_number: $(this).data('phone_number')
                },
                dataType: 'json',
                type: 'POST'
            }).done(function(res) {
                location.reload();
            });
        });

        $('.submitbtn').on('click', function() {
            $.ajax({
                url: `<?php echo get_uri('whatsboost/connect_account'); ?>`,
                type: 'POST',
                dataType: 'html',
                data: {
                    'wb_business_account_id': $('#wb_business_account_id').val(),
                    'wb_access_token': $('#wb_access_token').val(),
                    'submit' : $(this).val(),
                },
                success: function(response) {
                    response = JSON.parse(response);
                    if (response.type == 'success') {
                        appAlert.success(response.message, {
                            duration: 3000
                        });
                    } else {
                        appAlert.error(response.message, {
                            duration: 3000
                        });
                    }
                    setTimeout(function() {
                        location.reload();
                    }, 3000);
                }
            })
        });

        $('.disconnectbtn').on('click', function() {
            $.ajax({
                url: `<?php echo get_uri('whatsboost/disconnect'); ?>`,
                dataType: 'json',
                success: function(res) {
                    appAlert.error(res.message, {
                        duration: 3000
                    });
                    setTimeout(function() {
                        location.reload();
                    }, 3000);
                }
            })
        });

    });
</script>
