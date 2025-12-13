<?php

$total_templates         = wb_total_rows(get_db_prefix().'wb_templates');
$total_approved_template = wb_total_rows(get_db_prefix().'wb_templates', ['status' => 'APPROVED']);
$total_leads             = wb_total_rows(get_db_prefix().'clients', ['is_lead' => 1]);
$current_month_leads     = wb_total_rows(get_db_prefix().'clients', ['MONTH(created_date)' => date('m'), 'is_lead' => 1]);
$message_bots            = wb_total_rows(get_db_prefix().'wb_bot');
$template_bots           = wb_total_rows(get_db_prefix().'wb_campaigns', ['is_bot' => 1]);
$total_bots              = $message_bots + $template_bots;
$total_contacts          = wb_total_rows(get_db_prefix().'clients', ['is_lead' => 0]);
$current_month_contacts  = wb_total_rows(get_db_prefix().'clients', ['MONTH(created_date)' => date('m'), 'is_lead' => 0]);
$total_message_bot_send  = wb_sum_from_table(get_db_prefix().'wb_bot', ['field' => 'sending_count']);
$total_template_bot_send = wb_sum_from_table(get_db_prefix().'wb_campaigns', ['field' => 'sending_count', 'where' => ['is_bot' => 1]]);
$total_bot_send          = $total_message_bot_send + $total_template_bot_send;

?>
<div class="dashboards-row clearfix row">
    <div class="widget-container col-md-3">
        <div class="card dashboard-icon-widget">
            <div class="card-body-wp">
                <div class="widget-icon bg-warning">
                    <i data-feather="book-open" class='icon'></i>
                </div>
                <div class="widget-details">
                    <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('templates'); ?></p>
                    <h3 class="m-0 fw-bold"><?php echo $total_templates; ?></h3>
                    <span class="mb-2 fw-bold"><?php echo $total_approved_template; ?><span class="fw-normal"> <?php echo app_lang('approved'); ?></span></span>
                </div>
            </div>
        </div>
    </div>
    <div class="widget-container col-md-3">
        <div class="card dashboard-icon-widget">
            <div class="card-body-wp">
                <div class="widget-icon bg-info">
                    <i data-feather="user" class='icon'></i>
                </div>
                <div class="widget-details">
                    <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('leads'); ?></p>
                    <h3 class="m-0 fw-bold"><?php echo $total_leads; ?></h3>
                    <span class="mb-2 fw-bold"><?php echo $current_month_leads; ?><span class="fw-normal">
                            <?php echo app_lang('new_in_this_month'); ?></span></span>
                </div>
            </div>
        </div>
    </div>
    <div class="widget-container col-md-3">
        <div class="card dashboard-icon-widget">
            <div class="card-body-wp">
                <div class="widget-icon bg-success">
                    <i data-feather="check" class='icon'></i>
                </div>
                <div class="widget-details">
                    <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('contacts'); ?></p>
                    <h3 class="m-0 fw-bold"><?php echo $total_contacts; ?></h3>
                    <span class="mb-2 fw-bold"><?php echo $current_month_contacts; ?><span class="fw-normal">
                            <?php echo app_lang('new_in_this_month'); ?></span></span>
                </div>
            </div>
        </div>
    </div>
    <div class="widget-container col-md-3">
        <div class="card dashboard-icon-widget">
            <div class="card-body-wp">
                <div class="widget-icon bg-secondary">
                    <i data-feather="message-circle" class='icon'></i>
                </div>
                <div class="widget-details">
                    <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('bots'); ?></p>
                    <h3 class="m-0 fw-bold"><?php echo $total_bots; ?></h3>
                    <span class="mb-2 fw-bold"><?php echo $total_bot_send; ?><span class="fw-normal"> <?php echo app_lang('custom_message_sent'); ?></span></span>
                </div>
            </div>
        </div>
    </div>
</div>
