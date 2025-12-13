<style type="text/css">
    table {
        white-space: nowrap;
    }
</style>
<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="row">
        <div class="col-md-6">
            <div>
                <div class="card">
                    <div class="row">
                        <div class="col-md-12">
                            <div class="page-title clearfix rounded">
                                <h1><?php echo app_lang('request_details'); ?></h1>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-12" style="overflow-x: hidden;overflow: scroll;">
                                <?php if (null !== $log_data) { ?>
                                    <table class="table table-striped table-condensed table-hover" style="overflow-x: hidden;overflow: scroll;">
                                        <tr>
                                            <td><?php echo app_lang('action'); ?></td>
                                            <td><?php echo ('Message Bot' != $log_data->category) ? app_lang($log_data->category) : $log_data->category; ?></td>
                                        </tr>
                                        <tr>
                                            <td><?php echo strtoupper(app_lang('date')); ?></td>
                                            <td><?php echo $log_data->recorded_at; ?></td>
                                        </tr>
                                    </table>
                                    <?php echo app_lang('total_parameters'); ?>
                                    <?php if (null !== $log_data->category_params) { ?>
                                        <p>
                                        <pre><code class="language-json"><?php echo json_encode(json_decode(html_entity_decode($log_data->category_params)), \JSON_PRETTY_PRINT); ?></code></pre>
                                        </p>
                                    <?php } ?>
                                <?php } ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div>
                <div class="card">
                    <div class="row">
                        <div class="col-md-12">
                            <div class="page-title clearfix rounded">
                                <h1><?php echo app_lang('headers'); ?></h1>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-12" style="overflow-x: hidden;overflow: scroll;">
                                <?php if (null !== $log_data) { ?>
                                    <table class="table table-striped table-condensed table-hover" style="overflow-x: hidden;overflow: scroll;">
                                        <tr>
                                            <td><?php echo app_lang('phone_number_id'); ?></td>
                                            <td><?php echo $log_data->phone_number_id; ?></td>
                                        </tr>
                                        <tr>
                                            <td><?php echo app_lang('whatsapp_business_account_id'); ?></td>
                                            <td><?php echo $log_data->business_account_id; ?></td>
                                        </tr>
                                        <tr>
                                            <td><?php echo app_lang('whatsapp_access_token'); ?></td>
                                            <td><?php echo $log_data->access_token; ?></td>
                                        </tr>
                                    </table>
                                <?php } ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-6">
            <div>
                <div class="card">
                    <div class="page-title clearfix rounded">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h1><?php echo app_lang('raw_content'); ?></h1>
                            </div>
                            <div>
                                <?php if (null !== $log_data) { ?>
                                    <span class="badge bg-primary me-3"><?php echo app_lang('format_type').' : JSON'; ?></span>
                                <?php } ?>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-12">
                                <?php if (null !== $log_data) { ?>
                                    <?php if (null !== $log_data->raw_data) { ?>
                                        <p>
                                        <pre><code class="language-json"><?php echo json_encode(json_decode(html_entity_decode($log_data->raw_data)), \JSON_PRETTY_PRINT); ?></code></pre>
                                        </p>
                                    <?php } ?>
                                <?php } ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div>
                <div class="card">
                    <div class="page-title clearfix rounded">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h1><?php echo app_lang('response'); ?></h1>
                            </div>
                            <div>
                                <?php if (null !== $log_data) { ?>
                                    <span class="badge bg-primary me-3"><?php echo app_lang('response_code').' : '.$log_data->response_code; ?></span>
                                <?php } ?>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-12">
                                <?php if (null !== $log_data) { ?>
                                    <p>
                                        <?php if ((isset($log_data->response_data)) && (wbIsJson(html_entity_decode($log_data->response_data)))) { ?>
                                    <pre><code class="language-json"><?php echo json_encode(json_decode(html_entity_decode($log_data->response_data)), \JSON_PRETTY_PRINT); ?></code></pre>
                                <?php } else { ?>
                                    <div class="alert alert-danger">
                                        <p>
                                            <?php echo $log_data->response_data; ?>
                                        </p>
                                    </div>
                                <?php } ?>
                                </p>
                            <?php } ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
