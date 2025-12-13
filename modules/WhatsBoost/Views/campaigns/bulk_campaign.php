<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <h4 class="fw-semibold"><?php echo app_lang('campaigns_from_csv_file'); ?></h4>
    <?php echo form_open_multipart(get_uri('whatsboost/send_csv_campaigns'), ['id' => 'bulk_campaign_form']); ?>
    <input type="hidden" name="id" id="id" value="<?php echo $campaign['id'] ?? ''; ?>" class="temp_id">
    <div class="row">
        <div class="col-md-4">
            <div class="card rounded-bottom">
                <div class="card-header">
                    <h5 class=""><?php echo app_lang('campaign'); ?></h5>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="campaign_name" class="form-label"><?php echo app_lang('campaign_name'); ?></label>
                        <?php echo form_input([
                            'id'                 => 'name',
                            'name'               => 'name',
                            'value'              => $campaign['name'] ?? '',
                            'class'              => 'form-control',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                            'placeholder'        => '',
                        ]); ?>
                    </div>
                    <div class="csv_file_upload">
                        <div class="d-flex justify-content-between mt-3">
                            <span><?php echo app_lang('choose_csv_file') ?></span>
                            <span data-bs-toggle="modal" data-bs-target="#csvRuleModal"><a href="#" class="text-decoration-underline"><?php echo app_lang('download_sample_file_and_read_rules') ?></a></span>
                        </div>
                        <div class="col-md-12">
                            <div id="file-upload-dropzone" class="dropzone mb15">

                            </div>
                            <div id="file-upload-dropzone-scrollbar">
                                <div id="uploaded-file-previews">
                                    <div id="file-upload-row" class="box">
                                        <div class="preview box-content pr15" style="width:100px;">
                                            <img data-dz-thumbnail class="upload-thumbnail-sm" />
                                            <div class="progress upload-progress-sm active mt5" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                                                <div class="progress-bar progress-bar-striped progress-bar-animated progress-bar-success" style="width:0%;" data-dz-uploadprogress></div>
                                            </div>
                                        </div>
                                        <div class="box-content">
                                            <p class="name" data-dz-name></p>
                                            <p class="clearfix">
                                                <span class="size float-start" data-dz-size></span>
                                                <span data-dz-remove class="btn btn-default btn-sm border-circle float-end mr10 fs-14 margin-top-5">
                                                    <i data-feather="x" class="icon-16"></i>
                                                </span>
                                            </p>
                                            <strong class="error text-danger" data-dz-errormessage></strong>
                                            <input type="hidden" name="files" value="" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" id="json_file_path" name="json_file_path" value="">
                    <div class="error_note mtop10"></div>
                    <div class="hide bulk_template">
                        <div class="form-group">
                            <label for="template" class="form-label"><?php echo app_lang('template'); ?></label>
                            <?php echo form_dropdown([
                                'name'               => 'template_id',
                                'id'                 => 'template_id',
                                'class'              => 'form-control validate-hidden select2',
                                'data-rule-required' => true,
                                'data-msg-required'  => app_lang('field_required'),
                            ], wbGetTemplateList(), $campaign['template_id'] ?? ''); ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="variableDetailsFirst col-md-4 hide">
            <div class="card rounded-bottom">
                <div class="card-header">
                    <h5 class=""><?php echo app_lang('variables'); ?></h5>
                    <span class="text-muted"><?php echo app_lang('merge_field_note'); ?></span>
                </div>
                <div class="card-body">
                    <div class="variables"></div>
                </div>
            </div>
        </div>

        <div class="variableDetailsSecond col-md-4 hide">
            <div class="row" id="preview_message">
                <div class="col-md-12">
                    <div class="card rounded-bottom">
                        <div class="card-header">
                            <h5 class=""><?php echo app_lang('preview'); ?></h5>
                        </div>
                        <div class="" style="background: url('<?php echo base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/images/bg.png'); ?>');">
                            <div class="card-body">
                                <div class="wb_panel previewImage">
                                </div>
                                <div class="card m-0">
                                    <div class="card-body previewmsg">
                                    </div>
                                </div>
                                <div class="previewBtn">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-12">
                    <div class="card rounded-bottom">
                        <div class="card-header">
                            <h5 class=""><?php echo app_lang('send_campaign'); ?></h5>
                        </div>
                        <div class="card-body">
                            <button type="submit" id="send_bulk_campaign" class="btn btn-danger mtop15"><?php echo app_lang('send_campaign'); ?></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php echo form_close(); ?>
</div>
<!-- rules and download sample csv file model -->
<div class="modal fade" id="csvRuleModal" tabindex="-1" aria-labelledby="csvRuleModal" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="sampleModalLabel"><?= app_lang('download_sample') ?></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">

                <div class="alert alert-info">
                    <?php echo app_lang('csv_rule_1') ?>
                    <?php echo app_lang('csv_rule_2') ?>
                </div>

                <h6 class="mt-3"><?= app_lang('campaign') ?></h6>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th><?= app_lang('firstname') ?></th>
                            <th><?= app_lang('lastname') ?></th>
                            <th><span class="text-danger">*</span> <?= app_lang('phoneno') ?></th>
                            <th><?= app_lang('email') ?></th>
                            <th><?= app_lang('country') ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><?= app_lang('sample_data') ?></td>
                            <td><?= app_lang('sample_data') ?></td>
                            <td><?= app_lang('sample_data') ?></td>
                            <td>66d824de53e6b@example.com</td>
                            <td><?= app_lang('sample_data') ?></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-success"><a class="text-reset" href="<?php echo get_uri('whatsboost/csv_campaigns/download_sample'); ?>"><?= app_lang('download_sample') ?></a></button>
                <button type="button" class="btn btn-secondary btnupload" data-bs-dismiss="modal"><?= app_lang('close') ?></button>
            </div>
        </div>
    </div>
</div>
<script type="text/javascript">
    $(document).on('submit', '#bulk_campaign_form', function(event) {
        $('#send_bulk_campaign').attr('disabled', true);
    });
    window.campaignForm = $("#bulk_campaign_form").appForm({
        isModal: false,
        onSuccess: function(response) {
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
                window.location.href = "<?php echo get_uri('whatsboost/csv_campaigns') ?>";
            }, 2000);
        },
        onError: function(response) {
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
                window.location.href = "<?php echo get_uri('whatsboost/csv_campaigns') ?>";
            }, 2000);
        }
    });
</script>
